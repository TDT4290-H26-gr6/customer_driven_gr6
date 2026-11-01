import { describe, expect, it } from "vitest";
import {
  buildPieContent,
  IDK_VALUE,
  type AuthoredContent,
  type NativeElementContent,
  type PieContent,
} from "./pie";

type Choice = { value: string; correct: boolean };
function choicesOf(content: ReturnType<typeof buildPieContent>): Choice[] {
  return ((content as PieContent).models[0] as { choices: Choice[] }).choices;
}

describe("buildPieContent: every question type gets an 'I don't know' choice", () => {
  it("appends it last, never marked correct, for likert", () => {
    const content = buildPieContent("likert", "How confident are you?", {
      scale: { min: 1, max: 3, minLabel: "Not at all", maxLabel: "Very" },
    });
    const choices = choicesOf(content);
    expect(choices.at(-1)).toMatchObject({ value: IDK_VALUE, correct: false });
    expect(choices).toHaveLength(4); // 1, 2, 3, then IDK
  });

  it("appends it last for single_choice, alongside the authored options", () => {
    const content = buildPieContent("single_choice", "Pick one", {
      options: [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
      ],
      correctOptionIds: ["a"],
    });
    const choices = choicesOf(content);
    expect(choices.map((c) => c.value)).toEqual(["a", "b", IDK_VALUE]);
    expect(choices.at(-1)?.correct).toBe(false);
  });

  it("appends it last for true_false", () => {
    const content = buildPieContent("true_false", "Is this true?", {
      options: [
        { id: "true", text: "True" },
        { id: "false", text: "False" },
      ],
      correctOptionIds: ["true"],
    });
    expect(choicesOf(content).map((c) => c.value)).toEqual(["true", "false", IDK_VALUE]);
  });

  it("appends it last for multi_choice, as an unchecked checkbox choice", () => {
    const content = buildPieContent("multi_choice", "Pick all that apply", {
      options: [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
      ],
      correctOptionIds: ["a", "b"],
    });
    expect((content as PieContent).models[0]).toMatchObject({ choiceMode: "checkbox" });
    expect(choicesOf(content).map((c) => c.value)).toEqual(["a", "b", IDK_VALUE]);
  });
});

describe("buildPieContent: likert labels", () => {
  type LabelledChoice = Choice & { label: string };
  const labelled = (content: ReturnType<typeof buildPieContent>) =>
    choicesOf(content) as LabelledChoice[];

  it("labels only the ends when that's all the author gave", () => {
    const content = buildPieContent("likert", "How confident?", {
      scale: { min: 1, max: 3, minLabel: "Not at all", maxLabel: "Very" },
    });
    expect(labelled(content).map((c) => c.label)).toEqual([
      "<div>1 - Not at all</div>",
      "<div>2</div>",
      "<div>3 - Very</div>",
      expect.any(String), // "I don't know"
    ]);
  });

  it("gives every step its own text when labels are authored, keeping the number as the value", () => {
    const content = buildPieContent("likert", "How comfortable?", {
      scale: { min: 1, max: 3, labels: ["Not at all", "Somewhat", "Very"] },
    });
    const choices = labelled(content);
    expect(choices.slice(0, 3).map((c) => [c.value, c.label])).toEqual([
      ["1", "<div>Not at all</div>"],
      ["2", "<div>Somewhat</div>"],
      ["3", "<div>Very</div>"],
    ]);
  });
});

describe("buildPieContent: criteria_check", () => {
  const content = {
    exhibit: "README.md\nLicence: CC BY 4.0 <open>",
    options: [
      { id: "a", text: "States a licence" },
      { id: "b", text: "Gives a persistent identifier" },
    ],
    correctOptionIds: ["a"],
  };

  it("shows the example in its own box under the prompt, line breaks kept and escaped", () => {
    const model = (
      buildPieContent("criteria_check", "Which criteria does it meet?", content) as PieContent
    ).models[0] as { prompt: string; choiceMode: string };

    expect(model.prompt).toBe(
      '<p>Which criteria does it meet?</p><div class="aios-exhibit">README.md<br>Licence: CC BY 4.0 &lt;open&gt;</div>',
    );
    expect(model.choiceMode).toBe("checkbox");
  });

  it("marks the criteria the example meets as correct, plus 'I don't know' last", () => {
    const choices = choicesOf(buildPieContent("criteria_check", "Which?", content));
    expect(choices.map((c) => [c.value, c.correct])).toEqual([
      ["a", true],
      ["b", false],
      [IDK_VALUE, false],
    ]);
  });

  it("refuses an item without an example", () => {
    expect(() => buildPieContent("criteria_check", "Which?", { ...content, exhibit: " " })).toThrow(
      /needs content.exhibit/,
    );
  });
});

describe("buildPieContent: ordering", () => {
  const content = {
    options: [
      { id: "a", text: "Collect data" },
      { id: "b", text: "Clean data" },
      { id: "c", text: "Publish data" },
    ],
    correctOrder: ["a", "b", "c"],
  };

  it("builds a placement-ordering native element, not a PIE item config", () => {
    const result = buildPieContent(
      "ordering",
      "Put these in order",
      content,
    ) as NativeElementContent;
    expect(result.element).toBe("aios-placement-ordering");
    expect(result.model).toMatchObject({
      element: "aios-placement-ordering",
      choices: [
        { id: "a", label: "Collect data" },
        { id: "b", label: "Clean data" },
        { id: "c", label: "Publish data" },
      ],
      correctResponse: ["a", "b", "c"],
    });
  });

  it("escapes the prompt and choice labels", () => {
    const result = buildPieContent("ordering", "Pick <b>carefully</b>", {
      options: [{ id: "a", text: "<script>bad</script>" }],
      correctOrder: ["a"],
    }) as NativeElementContent;
    expect(result.model.prompt).toBe("<p>Pick &lt;b&gt;carefully&lt;/b&gt;</p>");
    expect((result.model.choices as { label: string }[])[0].label).toBe(
      "&lt;script&gt;bad&lt;/script&gt;",
    );
  });

  it("refuses an item without options", () => {
    expect(() => buildPieContent("ordering", "Order these", { correctOrder: ["a"] })).toThrow(
      /needs content.options/,
    );
  });

  it("refuses an item without a correct order", () => {
    expect(() => buildPieContent("ordering", "Order these", { options: content.options })).toThrow(
      /needs content.correctOrder/,
    );
  });

  it("refuses a correct order that references an option that doesn't exist", () => {
    expect(() =>
      buildPieContent("ordering", "Order these", { ...content, correctOrder: ["a", "b", "z"] }),
    ).toThrow(/unknown option id: z/);
  });

  it("refuses a correct order that doesn't cover every option", () => {
    expect(() =>
      buildPieContent("ordering", "Order these", { ...content, correctOrder: ["a", "b"] }),
    ).toThrow(/must list every option exactly once/);
  });
});

describe("buildPieContent: the matrix types", () => {
  const classify = {
    columns: [
      { id: "good", text: "Good practice" },
      { id: "poor", text: "Poor <practice>" },
    ],
    rows: [
      { id: "r1", text: "Maintain a README", correctColumnId: "good" },
      { id: "r2", text: "Keep only the latest file", correctColumnId: "poor" },
    ],
  };
  const modelOf = (content: ReturnType<typeof buildPieContent>) =>
    (content as NativeElementContent).model as {
      headers: string[];
      layout: number;
      rows: { id: string; title: string; values: boolean[] }[];
    };

  it("builds a match (matrix) native element: a row per item, a column per answer, 'I don't know' last", () => {
    const content = buildPieContent("classification_matrix", "Classify each practice", classify);
    expect(content).toMatchObject({
      element: "aios-match",
      model: {
        element: "aios-match",
        prompt: "<p>Classify each practice</p>",
        choiceMode: "radio",
        partialScoring: true,
      },
    });
    const model = modelOf(content);
    expect(model.headers).toEqual(["", "Good practice", "Poor &lt;practice&gt;", "I don't know"]);
    // The row texts' column, two answers and "I don't know".
    expect(model.layout).toBe(4);
    expect(model.rows).toEqual([
      { id: "r1", title: "Maintain a README", values: [true, false, false] },
      { id: "r2", title: "Keep only the latest file", values: [false, true, false] },
    ]);
  });

  it("gives a true/false matrix True and False columns, whatever was authored", () => {
    const model = modelOf(
      buildPieContent("true_false_matrix", "True or false?", {
        columns: [{ id: "x", text: "Ignored" }],
        rows: [
          { id: "s1", text: "A DOI is persistent.", correctColumnId: "true" },
          { id: "s2", text: "Every repository accepts everything.", correctColumnId: "false" },
        ],
      }),
    );
    expect(model.headers).toEqual(["", "True", "False", "I don't know"]);
    expect(model.rows.map((r) => r.values)).toEqual([
      [true, false, false],
      [false, true, false],
    ]);
  });

  it("allows matching with a distractor column and a column shared by two rows", () => {
    const model = modelOf(
      buildPieContent("matching", "Match each case", {
        columns: [
          { id: "deployer", text: "Deployer" },
          { id: "provider", text: "Provider" },
          { id: "neither", text: "Neither" },
        ],
        rows: [
          { id: "a", text: "Case A", correctColumnId: "deployer" },
          { id: "b", text: "Case B", correctColumnId: "deployer" },
          { id: "c", text: "Case C", correctColumnId: "provider" },
        ],
      }),
    );
    expect(model.rows.map((r) => r.values.indexOf(true))).toEqual([0, 0, 1]);
  });

  it.each([
    [{ ...classify, rows: [] }, /needs content.rows/],
    [{ ...classify, columns: [classify.columns[0]] }, /at least 2 columns/],
    [
      { ...classify, rows: [{ id: "r1", text: "x", correctColumnId: "nope" }] },
      /row "r1" has an unknown correctColumnId/,
    ],
  ])("refuses an unusable matrix (%#)", (content, error) => {
    expect(() => buildPieContent("classification_matrix", "Classify", content)).toThrow(error);
  });
});

describe("buildPieContent: no text can add markup", () => {
  // PIE renders prompts, labels and headers as HTML, so text written in the
  // curriculum editor must come out as text, never as a tag or a handler.
  const attack = `<img src=x onerror="alert(1)">`;
  const options = [
    { id: "a", text: attack },
    { id: "b", text: "Fine" },
  ];
  const cases: [string, AuthoredContent][] = [
    ["likert", { scale: { min: 1, max: 2, labels: [attack, "Fine"] } }],
    ["single_choice", { options, correctOptionIds: ["a"] }],
    ["true_false", { options, correctOptionIds: ["a"] }],
    ["multi_choice", { options, correctOptionIds: ["a"] }],
    ["criteria_check", { options, correctOptionIds: ["a"], exhibit: attack }],
    ["ordering", { options, correctOrder: ["a", "b"] }],
    [
      "classification_matrix",
      {
        columns: [
          { id: "c1", text: attack },
          { id: "c2", text: "Fine" },
        ],
        rows: [
          { id: "r1", text: attack, correctColumnId: "c1" },
          { id: "r2", text: "Fine", correctColumnId: "c2" },
        ],
      },
    ],
  ];

  it.each(cases)("%s escapes its prompt and every text", (questionType, content) => {
    const built = JSON.stringify(buildPieContent(questionType, attack, content));
    expect(built).not.toContain("<img");
    expect(built).toContain("&lt;img src=x onerror=");
  });

  it("leaves a prompt without markup characters exactly as written", () => {
    const content = buildPieContent("single_choice", `Is it "open"? Yes`, {
      options,
      correctOptionIds: ["b"],
    }) as PieContent;
    expect((content.models[0] as { prompt: string }).prompt).toBe(`Is it "open"? Yes`);
  });
});
