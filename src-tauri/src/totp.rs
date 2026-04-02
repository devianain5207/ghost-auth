use crate::storage::Account;
use serde::Serialize;
use totp_rs::{Algorithm, Secret, TOTP, TotpUrlError};
use url::{Host, Url};

struct ParsedOtpAuthUri {
    issuer: String,
    label: String,
    secret: String,
    algorithm: String,
    digits: u32,
    period: u32,
}

#[derive(Serialize, Clone)]
pub struct CodeResponse {
    pub id: String,
    pub code: String,
    pub remaining: u32,
}

fn to_algorithm(name: &str) -> Result<Algorithm, String> {
    match name.to_uppercase().as_str() {
        "SHA1" => Ok(Algorithm::SHA1),
        "SHA256" => Ok(Algorithm::SHA256),
        "SHA512" => Ok(Algorithm::SHA512),
        _ => Err("Unsupported algorithm".to_string()),
    }
}

fn validate_totp_params(algorithm: &str, digits: u32, period: u32) -> Result<(), String> {
    if !matches!(algorithm, "SHA1" | "SHA256" | "SHA512") {
        return Err("Unsupported algorithm".to_string());
    }
    if digits != 6 && digits != 8 {
        return Err("Unsupported digit count (only 6 or 8 supported)".to_string());
    }
    if !(15..=120).contains(&period) {
        return Err("Unsupported period (must be between 15 and 120 seconds)".to_string());
    }
    Ok(())
}

pub fn generate_code(account: &Account) -> Result<CodeResponse, String> {
    validate_totp_params(&account.algorithm, account.digits, account.period)?;
    let algorithm = to_algorithm(&account.algorithm)?;

    let secret_bytes = Secret::Encoded(account.secret.clone())
        .to_bytes()
        .map_err(|e| {
            tracing::warn!(error = %e, "Invalid TOTP secret");
            "Invalid account secret".to_string()
        })?;

    // Use new_unchecked to support real-world secrets that may be < 128 bits
    let totp = TOTP::new_unchecked(
        algorithm,
        account.digits as usize,
        1,
        account.period as u64,
        secret_bytes,
        Some(account.issuer.clone()),
        account.label.clone(),
    );

    let time = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|_| "System clock error".to_string())?
        .as_secs();

    let code = totp.generate(time);
    let remaining = (account.period as u64 - (time % account.period as u64)) as u32;

    Ok(CodeResponse {
        id: account.id.clone(),
        code,
        remaining,
    })
}

pub fn parse_otpauth_uri(uri: &str) -> Result<Account, String> {
    let parsed = parse_checked_with_short_secret_compat(uri)?;
    let algorithm = parsed.algorithm;
    let secret = parsed.secret;
    let digits = parsed.digits;
    let period = parsed.period;
    validate_totp_params(&algorithm, digits, period)
        .map_err(|_| "Unsupported TOTP parameters in QR code".to_string())?;
    if secret.is_empty() {
        return Err("Invalid QR code or URI format".to_string());
    }

    let issuer = truncate_to_chars(&parsed.issuer, 255);
    let label = truncate_to_chars(&parsed.label, 255);

    Ok(Account {
        id: uuid::Uuid::new_v4().to_string(),
        issuer,
        label,
        secret,
        algorithm,
        digits,
        period,
        icon: None,
        last_modified: 0,
    })
}

fn truncate_to_chars(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        s.chars().take(max).collect()
    }
}

fn parse_checked_with_short_secret_compat(uri: &str) -> Result<ParsedOtpAuthUri, String> {
    match TOTP::from_url(uri) {
        Ok(totp) => Ok(ParsedOtpAuthUri {
            issuer: totp.issuer.unwrap_or_default(),
            label: totp.account_name,
            secret: data_encoding::BASE32_NOPAD.encode(&totp.secret),
            algorithm: match totp.algorithm {
                Algorithm::SHA1 => "SHA1",
                Algorithm::SHA256 => "SHA256",
                Algorithm::SHA512 => "SHA512",
            }
            .to_string(),
            digits: totp.digits as u32,
            period: totp.step as u32,
        }),
        Err(TotpUrlError::SecretSize(_)) => parse_otpauth_uri_short_secret(uri),
        Err(e) => {
            tracing::warn!(error = ?e, "Invalid otpauth URI");
            Err("Invalid QR code or URI format".to_string())
        }
    }
}

fn parse_otpauth_uri_short_secret(uri: &str) -> Result<ParsedOtpAuthUri, String> {
    let url = Url::parse(uri).map_err(|e| {
        tracing::warn!(error = %e, "Invalid otpauth URI");
        "Invalid QR code or URI format".to_string()
    })?;
    if url.scheme() != "otpauth" {
        return Err("Invalid QR code or URI format".to_string());
    }
    match url.host() {
        Some(Host::Domain("totp")) => {}
        _ => return Err("Invalid QR code or URI format".to_string()),
    }

    let path = url.path().trim_start_matches('/');
    if path.is_empty() {
        return Err("Invalid QR code or URI format".to_string());
    }
    let path = urlencoding::decode(path).map_err(|e| {
        tracing::warn!(error = %e, "Invalid otpauth label encoding");
        "Invalid QR code or URI format".to_string()
    })?;

    let (path_issuer, label) = if let Some((issuer, account_name)) = path.split_once(':') {
        (Some(issuer.to_string()), account_name.to_string())
    } else {
        (None, path.to_string())
    };
    if label.is_empty() {
        return Err("Invalid QR code or URI format".to_string());
    }

    let mut secret: Option<String> = None;
    let mut issuer_query: Option<String> = None;
    let mut algorithm = "SHA1".to_string();
    let mut digits = 6u32;
    let mut period = 30u32;

    for (k, v) in url.query_pairs() {
        match k.as_ref() {
            "secret" => secret = Some(v.into_owned()),
            "issuer" => issuer_query = Some(v.into_owned()),
            "algorithm" => algorithm = v.to_uppercase(),
            "digits" => {
                digits = v
                    .parse::<u32>()
                    .map_err(|_| "Invalid QR code or URI format".to_string())?
            }
            "period" => {
                period = v
                    .parse::<u32>()
                    .map_err(|_| "Invalid QR code or URI format".to_string())?
            }
            _ => {}
        }
    }

    if let (Some(path_issuer), Some(query_issuer)) = (&path_issuer, &issuer_query)
        && path_issuer != query_issuer
    {
        return Err("Invalid QR code or URI format".to_string());
    }

    let issuer = issuer_query.or(path_issuer).unwrap_or_default();
    let secret = secret
        .map(|s| s.trim().to_uppercase().replace(' ', ""))
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "Invalid QR code or URI format".to_string())?;
    Secret::Encoded(secret.clone()).to_bytes().map_err(|e| {
        tracing::warn!(error = %e, "Invalid otpauth secret");
        "Invalid QR code or URI format".to_string()
    })?;

    tracing::info!(
        event = "otpauth_short_secret_compat",
        "Accepted otpauth URI with short secret via compatibility parser"
    );
    Ok(ParsedOtpAuthUri {
        issuer,
        label,
        secret,
        algorithm,
        digits,
        period,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_account() -> Account {
        Account {
            id: "test".to_string(),
            issuer: "TestService".to_string(),
            label: "testuser@example.com".to_string(),
            secret: "JBSWY3DPEHPK3PXP".to_string(),
            algorithm: "SHA1".to_string(),
            digits: 6,
            period: 30,
            icon: None,
            last_modified: 0,
        }
    }

    #[test]
    fn test_generate_code_length() {
        let account = test_account();
        let result = generate_code(&account).unwrap();
        assert_eq!(result.code.len(), 6);
        assert!(result.remaining > 0 && result.remaining <= 30);
    }

    #[test]
    fn test_generate_code_8_digits() {
        let mut account = test_account();
        account.digits = 8;
        let result = generate_code(&account).unwrap();
        assert_eq!(result.code.len(), 8);
    }

    #[test]
    fn test_parse_otpauth_uri() {
        let uri = "otpauth://totp/GitHub:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&algorithm=SHA1&digits=6&period=30";
        let account = parse_otpauth_uri(uri).unwrap();
        assert_eq!(account.issuer, "GitHub");
        assert_eq!(account.label, "user@example.com");
        assert_eq!(account.algorithm, "SHA1");
        assert_eq!(account.digits, 6);
        assert_eq!(account.period, 30);
    }

    #[test]
    fn test_parse_otpauth_uri_defaults() {
        let uri = "otpauth://totp/Service:user?secret=JBSWY3DPEHPK3PXP&issuer=Service";
        let account = parse_otpauth_uri(uri).unwrap();
        assert_eq!(account.issuer, "Service");
        assert_eq!(account.digits, 6);
        assert_eq!(account.period, 30);
    }

    #[test]
    fn test_roundtrip_parse_then_generate() {
        let uri = "otpauth://totp/TestService:testuser@example.com?secret=JBSWY3DPEHPK3PXP&issuer=TestService&algorithm=SHA1&digits=6&period=30";
        let account = parse_otpauth_uri(uri).unwrap();
        let result = generate_code(&account).unwrap();
        assert_eq!(result.code.len(), 6);
    }

    #[test]
    fn test_parse_otpauth_uri_rejects_invalid_digits() {
        let uri = "otpauth://totp/Test:user?secret=JBSWY3DPEHPK3PXP&issuer=Test&algorithm=SHA1&digits=7&period=30";
        let err = parse_otpauth_uri(uri).unwrap_err();
        assert!(err.contains("Unsupported TOTP parameters"));
    }

    #[test]
    fn test_parse_otpauth_uri_rejects_invalid_period() {
        let uri = "otpauth://totp/Test:user?secret=JBSWY3DPEHPK3PXP&issuer=Test&algorithm=SHA1&digits=6&period=10";
        let err = parse_otpauth_uri(uri).unwrap_err();
        assert!(err.contains("Unsupported TOTP parameters"));
    }

    #[test]
    fn test_generate_code_rejects_invalid_period() {
        let mut account = test_account();
        account.period = 0;
        assert!(generate_code(&account).is_err());
    }

    #[test]
    fn test_rfc6238_known_secret() {
        // RFC 6238 test secret: "12345678901234567890" -> base32
        let account = Account {
            id: "rfc".to_string(),
            issuer: "RFC".to_string(),
            label: "test".to_string(),
            secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ".to_string(),
            algorithm: "SHA1".to_string(),
            digits: 8,
            period: 30,
            icon: None,
            last_modified: 0,
        };
        let result = generate_code(&account).unwrap();
        assert_eq!(result.code.len(), 8);
    }
}
