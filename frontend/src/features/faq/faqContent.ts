// The FAQ's questions and answers, content only, so it can be edited without
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
        question: "How do I sign in?",
        answer: [
          "With your Google account or your ORCID iD. AIOS doesn't store a password for you. Use the same option each time, since signing in a different way can give you a separate account.",
        ],
      },
      {
        question: "Why do I have to fill in a profile first?",
        answer: [
          "Your profile (industry, academic degree, occupation or role, years of experience in AI or Open Science, and optionally your goals) helps tailor your recommendations to your work. You also confirm that you've read the information letter. You fill it in once before your first assessment, and can change it later in Settings.",
        ],
      },
      {
        question: "Can I use AIOS on my phone?",
        answer: [
          "Yes. On a phone the pages are in the bar at the bottom of the screen, and the FAQ and Settings are in the account menu in the top-right corner.",
        ],
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
          "The questions are grouped into five sections (A-E), which come in a random order, and each section has modules at four levels. You start at the first level of a section and move up to the next when you get at least 60% of a level's points. When a level is too difficult, you move on to the next section.",
          "So the number of questions depends on your answers, and the progress bar shows which section you're on rather than how many questions are left.",
        ],
      },
      {
        question: "What kinds of questions are there?",
        answer: [
          "Multiple choice (one or several correct answers), true/false, self-ratings where you choose how comfortable you are with something, putting items in the right order, and tables where you pick an answer for each statement or item.",
        ],
      },
      {
        question: "Should I guess if I don't know the answer?",
        answer: [
          'No. Choose "I don\'t know". It scores 0 for that question but never costs you anything extra, while ticking a wrong option on a question with several correct answers counts against you. Answering honestly also gives you better recommendations.',
        ],
      },
      {
        question: "Can I go back and change an answer?",
        answer: [
          "Not in the full self-assessment: once you press Next, your answer is final, so check it first. When you retake a single section or assess a learning journey, you can use Back to change earlier answers.",
        ],
      },
      {
        question: "Is there a guide to the assessment page?",
        answer: [
          "Yes. A short tour of the page opens before your first question. You can skip it, and open it again at any time with the ? button at the top of the page.",
        ],
      },
      {
        question: "Can I take a break and continue later?",
        answer: [
          'Yes. Your answers are saved as you go. Choose "Exit" and then "Save & exit", and the dashboard shows "Continue assessment" so you can pick up where you left off.',
          'If you\'d rather start over, choose "Abort and delete answers" instead, which removes the answers from that attempt. You can only have one assessment in progress at a time.',
        ],
      },
      {
        question: "Can I retake the assessment?",
        answer: [
          'Yes, with "Retake assessment" on the dashboard. You can retake the full assessment, or choose "A single section" to answer every question in just that section.',
          "A single-section retake updates that section on your dashboard, and the other sections keep their last result. It's listed under History, on the Partial assessments tab.",
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
          "The Overview tab shows a chart of your skills per section, your result in each section (and from your second assessment on, how it changed since the previous one), the learning journeys recommended for you, and personalised advice.",
          'The Detailed view tab shows your score per competence for any of your assessments, and "Compare with" puts two of them side by side.',
        ],
      },
      {
        question: 'What do "weak", "good" and "strong" mean?',
        answer: [
          "They describe a score: weak is 60% or below, good is 61-84%, and strong is 85% or above. Sections at 60% or below are the ones your learning journey recommendations focus on.",
        ],
      },
      {
        question: "What is the Competencies page?",
        answer: [
          'Your result in each module and an overall percentage per section. "Latest full assessment" shows your most recent full self-assessment, and "Best ever" your best result across all full self-assessments and learning journeys you\'ve assessed. Single-section retakes aren\'t counted here.',
          "At the top are the modules of the learning journey recommended for you.",
        ],
      },
      {
        question: "Where can I see my earlier assessments?",
        answer: [
          "Under History, with separate tabs for full assessments and partial ones (single-section retakes). Journey assessments are on the History tab of the Journeys page. To compare two assessments, use the dashboard's Detailed view.",
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
          "A learning journey is a set of modules built around a role or goal, for example running Open Science at an institution, research and teaching practice, academic research, business or policy. You take the learning material for it in Moodle. All journeys are listed on the Journeys page.",
        ],
      },
      {
        question: "How are learning journeys recommended to me?",
        answer: [
          "You're recommended two journeys, the best fit first. They're ranked on both your results (the sections where you scored low) and your profile, so a journey designed for your kind of work comes first. If the AI advisor isn't available, they're ranked on your scores alone. If none of your sections is weak, they're shown as journeys \"To keep improving\".",
        ],
      },
      {
        question: 'What does "Assess this journey" do?',
        answer: [
          "It starts a short assessment with only the questions from the sections that journey focuses on, for example to see how you've improved after taking it. It doesn't change your dashboard or your advice. Your result shows on the Journeys page's History tab, and your best result also counts under Competencies.",
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
          "From an AI model hosted by NTNU. It reads your scores and your profile, and writes a short summary with up to three next steps (modules in Moodle or courses from partner institutions) and picks the learning journeys that fit you best. It can only suggest material from AIOS, but it can make mistakes, so use its advice as a starting point.",
        ],
      },
      {
        question: "What does the AI see about me?",
        answer: [
          "Only your scores and your profile: industry, academic degree, occupation or role, years of experience and goals. Your name and email address are never sent to it. The model runs at NTNU, and the data doesn't leave NTNU's network.",
        ],
      },
      {
        question: "Why does my advice stay the same?",
        answer: [
          "The advice is written once for each completed self-assessment, full or single-section. Retake the assessment to get new advice based on your new results. Assessing a learning journey doesn't change it.",
        ],
      },
      {
        question: "The advice didn't load. What now?",
        answer: [
          "The AI advisor is sometimes busy or unavailable. Your dashboard still shows two recommended journeys, based on your scores alone, and the advice is tried again the next time you open the dashboard.",
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
          "Your name and email from Google or ORCID, your profile, your answers and scores, the advice written for you, and any feedback you send.",
        ],
      },
      {
        question: "Where can I read the information letter I consented to?",
        answer: [
          'In Settings, under "Information letter". It describes the research project, how your data is used and your rights.',
        ],
      },
      {
        question: "How do I delete my account?",
        answer: [
          'In Settings, under "Delete account". Your personal data (name, email, profile and advice) is deleted 30 days later, and until then you can cancel the deletion in the same place. If you sign in during those 30 days, you\'re asked whether you still want it deleted.',
          "Your answers and scores are kept for the research project, without your name or email.",
        ],
      },
      {
        question: "Can I change how AIOS looks?",
        answer: [
          'Yes. In Settings you can choose a light or dark theme, or "Default" to follow your device, and an accent colour from the AIOS logo.',
        ],
      },
      {
        question: "How do I give feedback or report a problem?",
        answer: [
          'Use the "Feedback" button in the bottom-right corner of any page. Rate how satisfied you are with AIOS, tell us what should be improved, or both, and if you like, how. It goes straight to the team, together with your name and email so we can follow up.',
        ],
      },
    ],
  },
];
