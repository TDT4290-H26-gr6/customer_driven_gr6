import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// RTL's own auto-cleanup only registers itself when it detects a global
// afterEach, this project imports test functions explicitly rather than
// using Vitest's `globals` option, so it never fires on its own.
afterEach(cleanup);
