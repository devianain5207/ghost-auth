import { render, screen, fireEvent, cleanup } from "@testing-library/svelte";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AccountList from "./AccountList.svelte";

const accounts = [
  {
    id: "a1",
    issuer: "GitHub",
    label: "user@github.com",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    icon: null,
  },
  {
    id: "a2",
    issuer: "Google",
    label: "user@gmail.com",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    icon: null,
  },
];

const accountsThree = [
  ...accounts,
  {
    id: "a3",
    issuer: "GitLab",
    label: "user@gitlab.com",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    icon: null,
  },
];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("AccountList", () => {
  it("reorders accounts after touch long-press drag", async () => {
    const onreorder = vi.fn();
    const ondelete = vi.fn();
    const onedit = vi.fn();

    render(AccountList, {
      props: {
        accounts,
        filtered: accounts,
        codes: new Map(),
        ondelete,
        onedit,
        onreorder,
        search: "",
      },
    });

    const items = screen.getByRole("list").querySelectorAll<HTMLElement>(":scope > li");
    const list = screen.getByRole("list");

    (items[0] as HTMLElement).getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 300,
      bottom: 100,
      width: 300,
      height: 100,
      toJSON: () => ({}),
    });

    (items[1] as HTMLElement).getBoundingClientRect = () => ({
      x: 0,
      y: 100,
      top: 100,
      left: 0,
      right: 300,
      bottom: 200,
      width: 300,
      height: 100,
      toJSON: () => ({}),
    });

    await fireEvent.pointerDown(items[0], {
      pointerId: 1,
      pointerType: "touch",
      button: 0,
      clientX: 10,
      clientY: 40,
    });

    vi.advanceTimersByTime(550);

    await fireEvent.pointerMove(list, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 10,
      clientY: 160,
    });

    await fireEvent.pointerUp(list, {
      pointerId: 1,
      pointerType: "touch",
      button: 0,
      clientX: 10,
      clientY: 160,
    });

    expect(onreorder).toHaveBeenCalledWith(["a2", "a1"]);
  });

  it("cancels long-press when touch moves too far before activation", async () => {
    const onreorder = vi.fn();
    const ondelete = vi.fn();
    const onedit = vi.fn();

    render(AccountList, {
      props: {
        accounts,
        filtered: accounts,
        codes: new Map(),
        ondelete,
        onedit,
        onreorder,
        search: "",
      },
    });

    const items = screen.getByRole("list").querySelectorAll<HTMLElement>(":scope > li");
    const list = screen.getByRole("list");

    await fireEvent.pointerDown(items[0], {
      pointerId: 2,
      pointerType: "touch",
      button: 0,
      clientX: 10,
      clientY: 40,
    });

    await fireEvent.pointerMove(list, {
      pointerId: 2,
      pointerType: "touch",
      clientX: 10,
      clientY: 78,
    });

    vi.advanceTimersByTime(550);

    await fireEvent.pointerUp(list, {
      pointerId: 2,
      pointerType: "touch",
      button: 0,
      clientX: 10,
      clientY: 78,
    });

    expect(onreorder).not.toHaveBeenCalled();
  });

  it("inserts at the correct index when dragging downward", async () => {
    const onreorder = vi.fn();
    const ondelete = vi.fn();
    const onedit = vi.fn();

    render(AccountList, {
      props: {
        accounts: accountsThree,
        filtered: accountsThree,
        codes: new Map(),
        ondelete,
        onedit,
        onreorder,
        search: "",
      },
    });

    const items = screen.getByRole("list").querySelectorAll<HTMLElement>(":scope > li");
    const list = screen.getByRole("list");

    (items[0] as HTMLElement).getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 300,
      bottom: 100,
      width: 300,
      height: 100,
      toJSON: () => ({}),
    });

    (items[1] as HTMLElement).getBoundingClientRect = () => ({
      x: 0,
      y: 100,
      top: 100,
      left: 0,
      right: 300,
      bottom: 200,
      width: 300,
      height: 100,
      toJSON: () => ({}),
    });

    (items[2] as HTMLElement).getBoundingClientRect = () => ({
      x: 0,
      y: 200,
      top: 200,
      left: 0,
      right: 300,
      bottom: 300,
      width: 300,
      height: 100,
      toJSON: () => ({}),
    });

    await fireEvent.pointerDown(items[0], {
      pointerId: 3,
      pointerType: "touch",
      button: 0,
      clientX: 10,
      clientY: 40,
    });

    vi.advanceTimersByTime(550);

    await fireEvent.pointerMove(list, {
      pointerId: 3,
      pointerType: "touch",
      clientX: 10,
      clientY: 220, // top half of third item => insert before a3
    });

    await fireEvent.pointerUp(list, {
      pointerId: 3,
      pointerType: "touch",
      button: 0,
      clientX: 10,
      clientY: 220,
    });

    expect(onreorder).toHaveBeenCalledWith(["a2", "a1", "a3"]);
  });

  it("allows dropping at the end of the list", async () => {
    const onreorder = vi.fn();
    const ondelete = vi.fn();
    const onedit = vi.fn();

    render(AccountList, {
      props: {
        accounts: accountsThree,
        filtered: accountsThree,
        codes: new Map(),
        ondelete,
        onedit,
        onreorder,
        search: "",
      },
    });

    const items = screen.getByRole("list").querySelectorAll<HTMLElement>(":scope > li");
    const list = screen.getByRole("list");

    (items[0] as HTMLElement).getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 300,
      bottom: 100,
      width: 300,
      height: 100,
      toJSON: () => ({}),
    });

    (items[1] as HTMLElement).getBoundingClientRect = () => ({
      x: 0,
      y: 100,
      top: 100,
      left: 0,
      right: 300,
      bottom: 200,
      width: 300,
      height: 100,
      toJSON: () => ({}),
    });

    (items[2] as HTMLElement).getBoundingClientRect = () => ({
      x: 0,
      y: 200,
      top: 200,
      left: 0,
      right: 300,
      bottom: 300,
      width: 300,
      height: 100,
      toJSON: () => ({}),
    });

    await fireEvent.pointerDown(items[1], {
      pointerId: 4,
      pointerType: "touch",
      button: 0,
      clientX: 10,
      clientY: 140,
    });

    vi.advanceTimersByTime(550);

    await fireEvent.pointerMove(list, {
      pointerId: 4,
      pointerType: "touch",
      clientX: 10,
      clientY: 330, // below last item => insert at end
    });

    await fireEvent.pointerUp(list, {
      pointerId: 4,
      pointerType: "touch",
      button: 0,
      clientX: 10,
      clientY: 330,
    });

    expect(onreorder).toHaveBeenCalledWith(["a1", "a3", "a2"]);
  });
});
