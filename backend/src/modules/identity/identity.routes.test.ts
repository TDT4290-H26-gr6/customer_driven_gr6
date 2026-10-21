import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { learner } from "../../test/fixtures";
import { tokenFor, useTestServer } from "../../test/httpTestServer";
import { hasCompletedMainAssessment } from "../assessment/assessment.service";
import * as identity from "./identity.service";

const { verifyIdToken } = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
vi.mock("google-auth-library", () => ({
  OAuth2Client: vi.fn(() => ({ verifyIdToken })),
}));
vi.mock("../../config", async (importOriginal) => {
  const { config } = await importOriginal<typeof import("../../config")>();
  return {
    config: {
      ...config,
      orcid: {
        clientId: "APP-1",
        clientSecret: "secret",
        redirectUri: "http://localhost:5173/auth/orcid/callback",
        baseUrl: "https://orcid.test",
        publicApiUrl: "https://pub.orcid.test",
      },
    },
  };
});
vi.mock("./identity.service");
vi.mock("../assessment/assessment.service");

const api = useTestServer();
const token = tokenFor("learner-1");

const validProfile = {
  name: "Ada Lovelace",
  industry: "higher_education",
  academicDegree: "phd",
  background: "Research software",
  yearsOfExperience: 4,
  goals: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(identity.findLearnerById).mockResolvedValue(learner());
});

describe("POST /auth/google", () => {
  const googleTicket = (payload: object | undefined) => ({ getPayload: () => payload });

  it("signs in with a verified Google token and returns a session", async () => {
    verifyIdToken.mockResolvedValue(
      googleTicket({ sub: "google-sub-1", email: "learner@example.com", name: "Ada" }),
    );
    vi.mocked(identity.upsertLearnerFromGoogle).mockResolvedValue(learner());

    const res = await api.request("POST", "/auth/google", { body: { credential: "google-jwt" } });

    expect(res.status).toBe(200);
    expect(identity.upsertLearnerFromGoogle).toHaveBeenCalledWith(
      "google-sub-1",
      "learner@example.com",
      "Ada",
    );
    expect(res.body).toMatchObject({
      token: expect.any(String),
      learner: { id: "learner-1", email: "learner@example.com" },
    });
  });

  it("rejects a missing credential with 400", async () => {
    const res = await api.request("POST", "/auth/google", { body: {} });
    expect(res.status).toBe(400);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it("rejects a credential Google doesn't accept with 401", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    verifyIdToken.mockRejectedValue(new Error("bad signature"));

    const res = await api.request("POST", "/auth/google", { body: { credential: "forged" } });

    expect(res.status).toBe(401);
    expect(identity.upsertLearnerFromGoogle).not.toHaveBeenCalled();
  });

  it("rejects a Google token without an email with 400", async () => {
    verifyIdToken.mockResolvedValue(googleTicket({ sub: "google-sub-1" }));
    const res = await api.request("POST", "/auth/google", { body: { credential: "google-jwt" } });
    expect(res.status).toBe(400);
  });
});

describe("POST /auth/orcid", () => {
  const json = (body: unknown, ok = true) => ({
    ok,
    status: ok ? 200 : 400,
    json: async () => body,
  });
  const ORCID = "0000-0002-1825-0097";
  // The test server itself is reached over real HTTP, so only ORCID's hosts are faked.
  const realFetch = globalThis.fetch;

  function fakeOrcid(handlers: { token: () => unknown; email?: () => unknown }) {
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      if (url.startsWith("https://orcid.test/oauth/token"))
        return Promise.resolve(handlers.token());
      if (url.startsWith("https://pub.orcid.test/")) {
        return Promise.resolve(handlers.email?.() ?? json({ email: [] }));
      }
      return realFetch(url, init);
    });
  }

  afterEach(() => vi.unstubAllGlobals());

  it("exchanges the code, links by the public verified email and returns a session", async () => {
    fakeOrcid({
      token: () => json({ orcid: ORCID, name: "Ada Lovelace" }),
      email: () => json({ email: [{ email: "ada@example.com", verified: true, primary: true }] }),
    });
    vi.mocked(identity.upsertLearnerFromOrcid).mockResolvedValue(learner());

    const res = await api.request("POST", "/auth/orcid", { body: { code: "abc123" } });

    expect(res.status).toBe(200);
    expect(identity.upsertLearnerFromOrcid).toHaveBeenCalledWith(
      ORCID,
      "ada@example.com",
      true,
      "Ada Lovelace",
    );
    expect(res.body).toMatchObject({ token: expect.any(String), learner: { id: "learner-1" } });
  });

  it("still signs in, without an email, when the record shares none", async () => {
    fakeOrcid({ token: () => json({ orcid: ORCID }) });
    vi.mocked(identity.upsertLearnerFromOrcid).mockResolvedValue(learner());

    const res = await api.request("POST", "/auth/orcid", { body: { code: "abc123" } });

    expect(res.status).toBe(200);
    expect(identity.upsertLearnerFromOrcid).toHaveBeenCalledWith(ORCID, null, false, null);
  });

  it("rejects a missing code with 400", async () => {
    const res = await api.request("POST", "/auth/orcid", { body: {} });
    expect(res.status).toBe(400);
  });

  it("rejects a code ORCID doesn't accept with 401", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fakeOrcid({ token: () => json({ error: "invalid_grant" }, false) });

    const res = await api.request("POST", "/auth/orcid", { body: { code: "stale" } });

    expect(res.status).toBe(401);
    expect(identity.upsertLearnerFromOrcid).not.toHaveBeenCalled();
  });

  it("rejects a response without a valid ORCID iD with 401", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fakeOrcid({ token: () => json({ orcid: "not-an-id" }) });

    const res = await api.request("POST", "/auth/orcid", { body: { code: "abc123" } });

    expect(res.status).toBe(401);
  });
});

describe("GET /auth/me", () => {
  it("returns the signed-in learner", async () => {
    const res = await api.request("GET", "/auth/me", { token });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "learner-1", hasCompletedProfile: false });
  });

  it("needs a session", async () => {
    expect((await api.request("GET", "/auth/me")).status).toBe(401);
    expect((await api.request("GET", "/auth/me", { token: "not-a-jwt" })).status).toBe(401);
  });

  it("is 404 when the account no longer exists", async () => {
    vi.mocked(identity.findLearnerById).mockResolvedValue(null);
    expect((await api.request("GET", "/auth/me", { token })).status).toBe(404);
  });
});

describe("roles", () => {
  const role = { id: "role-1", name: "Data steward", createdAt: new Date(), updatedAt: new Date() };

  it("GET /roles lists the roles", async () => {
    vi.mocked(identity.listRoles).mockResolvedValue([role]);
    const res = await api.request("GET", "/roles", { token });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({ id: "role-1", name: "Data steward" })]);
  });

  it("PUT /auth/me/role sets a known role", async () => {
    vi.mocked(identity.findRole).mockResolvedValue(role);
    vi.mocked(identity.setLearnerRole).mockResolvedValue(
      learner({ roleId: "role-1", userRole: role }),
    );

    const res = await api.request("PUT", "/auth/me/role", { token, body: { roleId: "role-1" } });

    expect(res.status).toBe(200);
    expect(identity.setLearnerRole).toHaveBeenCalledWith("learner-1", "role-1");
    expect(res.body).toMatchObject({ role: { id: "role-1" } });
  });

  it("PUT /auth/me/role is 404 for an unknown role and 400 without one", async () => {
    vi.mocked(identity.findRole).mockResolvedValue(null);
    const unknown = await api.request("PUT", "/auth/me/role", { token, body: { roleId: "nope" } });
    expect(unknown.status).toBe(404);

    const missing = await api.request("PUT", "/auth/me/role", { token, body: {} });
    expect(missing.status).toBe(400);
    expect(identity.setLearnerRole).not.toHaveBeenCalled();
  });
});

describe("PUT /auth/me/initial-assessment", () => {
  it("unlocks the dashboard once the main assessment is finished", async () => {
    vi.mocked(hasCompletedMainAssessment).mockResolvedValue(true);
    vi.mocked(identity.completeInitialAssessment).mockResolvedValue(
      learner({ hasCompletedInitialAssessment: true }),
    );

    const res = await api.request("PUT", "/auth/me/initial-assessment", { token });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ hasCompletedInitialAssessment: true });
  });

  it("is 409 while the main assessment isn't finished", async () => {
    vi.mocked(hasCompletedMainAssessment).mockResolvedValue(false);
    const res = await api.request("PUT", "/auth/me/initial-assessment", { token });
    expect(res.status).toBe(409);
    expect(identity.completeInitialAssessment).not.toHaveBeenCalled();
  });

  it("is 401 for a deleted account (requireRole)", async () => {
    vi.mocked(identity.findLearnerById).mockResolvedValue(null);
    expect((await api.request("PUT", "/auth/me/initial-assessment", { token })).status).toBe(401);
  });
});

describe("profile", () => {
  it("GET /auth/me/profile returns the saved profile", async () => {
    vi.mocked(identity.getLearnerProfile).mockResolvedValue({
      ...validProfile,
      goals: "Learn FAIR",
    } as never);
    const res = await api.request("GET", "/auth/me/profile", { token });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ industry: "higher_education", goals: "Learn FAIR" });
  });

  it("GET /auth/me/profile is 401 for a deleted account", async () => {
    vi.mocked(identity.findLearnerById).mockResolvedValue(null);
    expect((await api.request("GET", "/auth/me/profile", { token })).status).toBe(401);
  });

  it("PUT /auth/me/profile saves a valid profile", async () => {
    vi.mocked(identity.saveLearnerProfile).mockResolvedValue(learner({ name: "Ada Lovelace" }));

    const res = await api.request("PUT", "/auth/me/profile", { token, body: validProfile });

    expect(res.status).toBe(200);
    expect(identity.saveLearnerProfile).toHaveBeenCalledWith(
      "learner-1",
      expect.objectContaining({ name: "Ada Lovelace", yearsOfExperience: 4 }),
    );
    expect(res.body).toMatchObject({ name: "Ada Lovelace" });
  });

  it("PUT /auth/me/profile rejects an invalid profile with 400", async () => {
    const res = await api.request("PUT", "/auth/me/profile", {
      token,
      body: { ...validProfile, industry: "space" },
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: expect.stringContaining("industry") });
    expect(identity.saveLearnerProfile).not.toHaveBeenCalled();
  });

  it("PUT /auth/me/profile is 401 for a deleted account", async () => {
    vi.mocked(identity.findLearnerById).mockResolvedValue(null);
    const res = await api.request("PUT", "/auth/me/profile", { token, body: validProfile });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /auth/me", () => {
  it("deletes the signed-in learner's account", async () => {
    const res = await api.request("DELETE", "/auth/me", { token });
    expect(res.status).toBe(204);
    expect(identity.deleteLearner).toHaveBeenCalledWith("learner-1");
  });

  it("can't be called without a session", async () => {
    expect((await api.request("DELETE", "/auth/me")).status).toBe(401);
    expect(identity.deleteLearner).not.toHaveBeenCalled();
  });
});
