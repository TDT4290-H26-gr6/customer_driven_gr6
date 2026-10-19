// The FAQ's questions and answers — content only, so it can be edited without
// touching the page. Each answer is one or more paragraphs of plain text.
// Keep answers in line with how the app actually behaves; they were written
// against it (thresholds, button names, what's stored).

export type FaqEntry = { question: string; answer: string[] };
export type FaqCategory = { id: string; title: string; entries: FaqEntry[] };

export const FAQ: FaqCategory[] = [
  {
    id: "getting-started",
    title: "Getting started",
    entries: [
      {
        question: "What is AIOS?",
        answer: [
          "AIOS is a self-assessment tool for skills in AI and Open Science. You answer questions about your knowledge and practice, see where you stand, and get recommendations for learning journeys and modules that can help you improve.",
        ],
      },
      {
        question: "Why do I have to fill in a profile first?",
        answer: [
          "Your profile (industry, academic degree, occupation and years of experience in AI or Open Science) helps tailor your recommendations to your role. You fill it in once before your first assessment, and can change it later in Settings.",
        ],
      },
      {
        question: "How do I sign in?",
        answer: ["You sign in with your Google account. AIOS doesn't store a password for you."],
      },
    ],
  },
  {
    id: "assessment",
    title: "The self-assessment",
    entries: [
      {
        question: "How does the self-assessment work?",
        answer: [
          "The questions are grouped into sections (A-E), and each section into modules. You start at the first module of a section and move up to the next when you answer most of its questions correctly. When a module is too difficult, you move on to the next section, so the number of questions depends on your answers.",
        ],
      },
      {
        question: "What kinds of questions are there?",
        answer: [
          "Multiple choice (one or several correct answers), true/false, self-ratings where you choose how comfortable you are with something, and questions where you judge an example, such as a README or a data-sharing plan, against quality criteria.",
        ],
      },
      {
        question: "Should I guess if I don't know the answer?",
        answer: [
          'No. Choose "I don\'t know". It scores 0 for that question but never costs you anything extra, while ticking a wrong option on a question with several correct answers counts against you. Answering honestly also gives you better recommendations.',
        ],
      },
      {
        question: "Can I take a break and continue later?",
        answer: [
          'Yes. Choose "Save & exit" and your answers are kept. The dashboard then shows "Continue assessment" so you can pick up where you left off.',
          'If you\'d rather start over, choose "Abort" instead, which deletes the answers from that attempt.',
        ],
      },
      {
        question: "Can I retake the assessment?",
        answer: [
          "Yes, with \"Retake assessment\" on the dashboard. If you've completed a learning journey, you can say which one and retake only the sections it trained, to see how much you've improved.",
        ],
      },
    ],
  },
  {
    id: "results",
    title: "Your results",
    entries: [
      {
        question: "What does the dashboard show?",
        answer: [
          "An overview of your skills per section, how you've changed since your previous assessment (from the second one on), the learning journeys recommended for you, the areas where you're lacking, and personalised advice.",
        ],
      },
      {
        question: 'What do "weak", "good" and "strong" mean?',
        answer: [
          'They describe a score: weak is 60% or below, good is 61-84%, and strong is 85% or above. Areas at 60% or below are also listed under "Where you\'re lacking" on the dashboard.',
        ],
      },
      {
        question: "What is the Competencies tab?",
        answer: [
          "Your best result in each module, across all your assessments (the self-assessment and any learning journeys you've assessed) and an overall percentage per section. The modules of the journey recommended for you are shown at the top.",
        ],
      },
      {
        question: "Where can I see my earlier assessments?",
        answer: [
          'Under History. You can also open "See results by section" on the dashboard to look at any assessment in detail, or compare two of them.',
        ],
      },
    ],
  },
  {
    id: "journeys",
    title: "Learning journeys and recommendations",
    entries: [
      {
        question: "What is a learning journey?",
        answer: [
          "A learning journey is a set of modules built around a role or goal, for example research data work, teaching, policy or business. You take the learning material for it in Moodle.",
        ],
      },
      {
        question: "How are learning journeys recommended to me?",
        answer: [
          "You're recommended two journeys, best fit first. They're ranked on both your results (the sections where you scored low) and your profile, so a journey designed for your kind of work comes first. If the AI advisor isn't available, they're ranked on your scores alone.",
        ],
      },
      {
        question: 'What does "Assess this journey" do?',
        answer: [
          "It starts a short assessment with only the questions from the sections that journey focuses on. It doesn't change your self-assessment or your dashboard; your result shows under Competencies. You can only have one assessment in progress at a time.",
        ],
      },
      {
        question: "What is on the Sources page?",
        answer: [
          "Courses and resources from partner institutions that can help you build your skills, with a link to each one's own page.",
        ],
      },
      {
        question: "A link to Moodle doesn't open the course. Why?",
        answer: [
          "The learning material in Moodle is still being set up, so some links may not lead to their course yet. You may also need to log in to Moodle with your institution's account.",
        ],
      },
    ],
  },
  {
    id: "ai",
    title: "The AI advisor",
    entries: [
      {
        question: "Where does the personalised advice come from?",
        answer: [
          "From an AI model hosted by NTNU. It reads your scores and your profile and suggests what to work on next, including up to three modules and the learning journeys that fit you best. It can make mistakes, so use its advice as a starting point.",
        ],
      },
      {
        question: "What does the AI see about me?",
        answer: [
          "Only your scores and your profile: industry, academic degree, occupation, years of experience and goals. Your name and email address are never sent to it. The model runs at NTNU, and the data doesn't leave NTNU's network.",
        ],
      },
      {
        question: "Why does my advice stay the same?",
        answer: [
          "The advice is written once for each completed assessment. Take the assessment again to get new advice based on your new results.",
        ],
      },
    ],
  },
  {
    id: "privacy",
    title: "Your data and account",
    entries: [
      {
        question: "What data does AIOS store about me?",
        answer: [
          "Your name and email from Google sign-in, your profile, your answers and scores, the advice written for you, and any feedback you send.",
        ],
      },
      {
        question: "How do I delete my account?",
        answer: [
          'In Settings, under "Delete account". It permanently deletes your account and everything tied to it: answers, scores, profile, advice and feedback. This can\'t be undone.',
        ],
      },
      {
        question: "Can I change how AIOS looks?",
        answer: [
          "Yes. In Settings you can choose a light or dark theme (or follow your device) and an accent colour from the AIOS logo.",
        ],
      },
      {
        question: "How do I give feedback or report a problem?",
        answer: [
          'Use the "Feedback" button in the bottom-right corner of any page. Tell us what could be better and, if you like, how; it goes straight to the team.',
        ],
      },
    ],
  },
];
