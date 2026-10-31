import { beforeEach, describe, expect, it, vi } from "vitest";
import { learner } from "../../test/fixtures";
import { tokenFor, useTestServer } from "../../test/httpTestServer";
import { isAdminEmail } from "../identity/identity.admin";
import { findLearnerById } from "../identity/identity.service";
import * as curriculum from "./curriculum.service";

vi.mock("../identity/identity.service");
vi.mock("../identity/identity.admin");
vi.mock("./curriculum.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./curriculum.service")>();
  return {
    isUniqueViolation: actual.isUniqueViolation,
    getCurriculum: vi.fn(),
    getQuestion: vi.fn(),
    createQuestion: vi.fn(),
    updateQuestion: vi.fn(),
    removeQuestion: vi.fn(),
    restoreQuestion: vi.fn(),
    createCompetence: vi.fn(),
    updateCompetence: vi.fn(),
    createSection: vi.fn(),
    updateSection: vi.fn(),
    removeSection: vi.fn(),
    restoreSection: vi.fn(),
    createModule: vi.fn(),
    updateModule: vi.fn(),
    removeModule: vi.fn(),
    restoreModule: vi.fn(),
    createJourney: vi.fn(),
    updateJourney: vi.fn(),
    removeJourney: vi.fn(),
    restoreJourney: vi.fn(),
  };
});

const api = useTestServer();
const token = tokenFor("admin-1");

const question = {
  questionType: "true_false",
  prompt: "Open data is free to reuse.",
  sectionModuleId: "mod-1",
  competenceId: "c-1",
  content: {
    options: [
      { id: "t", text: "True" },
      { id: "f", text: "False" },
    ],
    correctOptionIds: ["t"],
  },
};

const taken = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(findLearnerById).mockResolvedValue(learner({ id: "admin-1" }));
  vi.mocked(isAdminEmail).mockReturnValue(true);
});

describe("access", () => {
  it.each([
    ["GET", "/admin/curriculum"],
    ["POST", "/admin/curriculum/questions"],
    ["DELETE", "/admin/curriculum/questions/q-1"],
    ["PUT", "/admin/curriculum/competences/c-1"],
  ])("%s %s is admin only", async (method, path) => {
    vi.mocked(isAdminEmail).mockReturnValue(false);
    const body = method === "GET" ? undefined : {};
    expect((await api.request(method, path, { token, body })).status).toBe(403);
    expect((await api.request(method, path, { body })).status).toBe(401);
  });
});

it("GET /admin/curriculum returns the overview", async () => {
  vi.mocked(curriculum.getCurriculum).mockResolvedValue({ sections: [] } as never);
  const res = await api.request("GET", "/admin/curriculum", { token });
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ sections: [] });
});

describe("questions", () => {
  it("POST /preview builds the question without saving it", async () => {
    const res = await api.request("POST", "/admin/curriculum/questions/preview", {
      token,
      body: question,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ content: { models: [{ choiceMode: "radio" }] } });
    expect(curriculum.createQuestion).not.toHaveBeenCalled();
  });

  it("POST /preview is a 400 for an invalid question", async () => {
    const res = await api.request("POST", "/admin/curriculum/questions/preview", {
      token,
      body: { ...question, prompt: "" },
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Write the question" });
  });

  it("GET /questions/:id returns one question, or 404", async () => {
    vi.mocked(curriculum.getQuestion).mockResolvedValueOnce({ id: "q-1" } as never);
    expect((await api.request("GET", "/admin/curriculum/questions/q-1", { token })).body).toEqual({
      id: "q-1",
    });
    vi.mocked(curriculum.getQuestion).mockResolvedValueOnce(null);
    expect((await api.request("GET", "/admin/curriculum/questions/x", { token })).status).toBe(404);
  });

  it("POST /questions creates a validated question", async () => {
    vi.mocked(curriculum.createQuestion).mockResolvedValue({ ok: true, id: "q-new" });
    const res = await api.request("POST", "/admin/curriculum/questions", { token, body: question });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: "q-new" });
    expect(curriculum.createQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        questionType: "true_false",
        prompt: "Open data is free to reuse.",
      }),
    );
  });

  it("POST /questions passes on a refusal, and rejects invalid input", async () => {
    vi.mocked(curriculum.createQuestion).mockResolvedValue({
      ok: false,
      status: 400,
      error: "The module or competence no longer exists",
    });
    expect(
      (await api.request("POST", "/admin/curriculum/questions", { token, body: question })).status,
    ).toBe(400);

    const invalid = await api.request("POST", "/admin/curriculum/questions", {
      token,
      body: { ...question, content: { options: question.content.options, correctOptionIds: [] } },
    });
    expect(invalid.status).toBe(400);
    expect(curriculum.createQuestion).toHaveBeenCalledTimes(1);
  });

  it("PUT /questions/:id saves an edit, or passes on a refusal", async () => {
    vi.mocked(curriculum.updateQuestion).mockResolvedValueOnce({ ok: true, id: "q-1" });
    expect(
      (await api.request("PUT", "/admin/curriculum/questions/q-1", { token, body: question }))
        .status,
    ).toBe(200);

    vi.mocked(curriculum.updateQuestion).mockResolvedValueOnce({
      ok: false,
      status: 409,
      error: "type can't change",
    });
    const refused = await api.request("PUT", "/admin/curriculum/questions/q-1", {
      token,
      body: question,
    });
    expect(refused.status).toBe(409);

    expect(
      (await api.request("PUT", "/admin/curriculum/questions/q-1", { token, body: {} })).status,
    ).toBe(400);
  });

  it.each(["deleted", "retired"] as const)(
    "DELETE /questions/:id reports it was %s",
    async (result) => {
      vi.mocked(curriculum.removeQuestion).mockResolvedValue(result);
      const res = await api.request("DELETE", "/admin/curriculum/questions/q-1", { token });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ result });
    },
  );

  it("DELETE and restore are 404 for an unknown question", async () => {
    vi.mocked(curriculum.removeQuestion).mockResolvedValue(null);
    vi.mocked(curriculum.restoreQuestion).mockResolvedValue(false);
    expect((await api.request("DELETE", "/admin/curriculum/questions/x", { token })).status).toBe(
      404,
    );
    expect(
      (await api.request("POST", "/admin/curriculum/questions/x/restore", { token })).status,
    ).toBe(404);
  });

  it("POST /questions/:id/restore brings it back", async () => {
    vi.mocked(curriculum.restoreQuestion).mockResolvedValue(true);
    const res = await api.request("POST", "/admin/curriculum/questions/q-1/restore", { token });
    expect(res.status).toBe(204);
  });
});

describe("competences", () => {
  it("POST creates one, 409 when the name is taken, 400 without a name", async () => {
    vi.mocked(curriculum.createCompetence).mockResolvedValueOnce({ id: "c-9" } as never);
    const created = await api.request("POST", "/admin/curriculum/competences", {
      token,
      body: { name: "Licensing" },
    });
    expect(created.status).toBe(201);

    vi.mocked(curriculum.createCompetence).mockRejectedValueOnce(taken);
    expect(
      (
        await api.request("POST", "/admin/curriculum/competences", {
          token,
          body: { name: "Licensing" },
        })
      ).status,
    ).toBe(409);

    expect(
      (await api.request("POST", "/admin/curriculum/competences", { token, body: {} })).status,
    ).toBe(400);
  });

  it("PUT renames one: 404 when unknown, 409 when the name is taken, 400 without a name", async () => {
    vi.mocked(curriculum.updateCompetence).mockResolvedValueOnce({ id: "c-1" } as never);
    expect(
      (
        await api.request("PUT", "/admin/curriculum/competences/c-1", {
          token,
          body: { name: "New" },
        })
      ).status,
    ).toBe(200);

    vi.mocked(curriculum.updateCompetence).mockResolvedValueOnce(null);
    expect(
      (
        await api.request("PUT", "/admin/curriculum/competences/x", {
          token,
          body: { name: "New" },
        })
      ).status,
    ).toBe(404);

    vi.mocked(curriculum.updateCompetence).mockRejectedValueOnce(taken);
    expect(
      (
        await api.request("PUT", "/admin/curriculum/competences/c-1", {
          token,
          body: { name: "New" },
        })
      ).status,
    ).toBe(409);

    expect(
      (await api.request("PUT", "/admin/curriculum/competences/c-1", { token, body: {} })).status,
    ).toBe(400);
  });

  it("passes other failures on as a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(curriculum.createCompetence).mockRejectedValueOnce(new Error("db down"));
    vi.mocked(curriculum.updateCompetence).mockRejectedValueOnce(new Error("db down"));
    expect(
      (await api.request("POST", "/admin/curriculum/competences", { token, body: { name: "X" } }))
        .status,
    ).toBe(500);
    expect(
      (
        await api.request("PUT", "/admin/curriculum/competences/c-1", {
          token,
          body: { name: "X" },
        })
      ).status,
    ).toBe(500);
  });
});

describe.each([
  {
    path: "/admin/curriculum/sections",
    label: "section",
    body: { code: "F", name: "Open education" },
    invalid: { name: "" },
    fns: ["createSection", "updateSection", "removeSection", "restoreSection"] as const,
  },
  {
    path: "/admin/curriculum/modules",
    label: "module",
    body: { name: "Licences", sectionId: "sec-a", mainCompetenceId: "c-1", level: 1 },
    invalid: { name: "Licences" },
    fns: ["createModule", "updateModule", "removeModule", "restoreModule"] as const,
  },
  {
    path: "/admin/curriculum/journeys",
    label: "journey",
    body: { name: "Data steward", sections: [{ sectionId: "sec-a", coverageLevel: "M" }] },
    invalid: { name: "Data steward", sections: [{ sectionId: "sec-a", coverageLevel: "R" }] },
    fns: ["createJourney", "updateJourney", "removeJourney", "restoreJourney"] as const,
  },
])("$path", ({ path, label, body, invalid, fns: [create, update, remove, restore] }) => {
  it("creates one (201), and rejects invalid input (400)", async () => {
    vi.mocked(curriculum[create]).mockResolvedValue({ ok: true, id: "new" });
    const res = await api.request("POST", path, { token, body });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: "new" });
    expect((await api.request("POST", path, { token, body: invalid })).status).toBe(400);
  });

  it("edits one, passing on a 404 and turning a taken name into a 409", async () => {
    vi.mocked(curriculum[update]).mockResolvedValueOnce({ ok: true, id: "x" });
    expect((await api.request("PUT", `${path}/x`, { token, body })).status).toBe(200);

    vi.mocked(curriculum[update]).mockResolvedValueOnce({
      ok: false,
      status: 404,
      error: "Unknown",
    });
    expect((await api.request("PUT", `${path}/x`, { token, body })).status).toBe(404);

    vi.mocked(curriculum[update]).mockRejectedValueOnce(taken);
    const conflict = await api.request("PUT", `${path}/x`, { token, body });
    expect(conflict.status).toBe(409);
    expect(conflict.body).toEqual({ error: expect.stringContaining(`A ${label} with that name`) });

    expect((await api.request("PUT", `${path}/x`, { token, body: invalid })).status).toBe(400);
  });

  it("passes other failures on as a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(curriculum[create]).mockRejectedValue(new Error("db down"));
    expect((await api.request("POST", path, { token, body })).status).toBe(500);
  });

  it.each(["deleted", "retired"] as const)("DELETE reports it was %s", async (result) => {
    vi.mocked(curriculum[remove]).mockResolvedValue(result);
    const res = await api.request("DELETE", `${path}/x`, { token });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ result });
  });

  it("DELETE and restore are 404 when unknown; restore is 204", async () => {
    vi.mocked(curriculum[remove]).mockResolvedValue(null);
    expect((await api.request("DELETE", `${path}/x`, { token })).status).toBe(404);
    vi.mocked(curriculum[restore]).mockResolvedValueOnce(false);
    expect((await api.request("POST", `${path}/x/restore`, { token })).status).toBe(404);
    vi.mocked(curriculum[restore]).mockResolvedValueOnce(true);
    expect((await api.request("POST", `${path}/x/restore`, { token })).status).toBe(204);
  });

  it("is admin only", async () => {
    vi.mocked(isAdminEmail).mockReturnValue(false);
    expect((await api.request("POST", path, { token, body })).status).toBe(403);
  });
});
