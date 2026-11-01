// The AIOS information letter (Sikt template), shown in a modal (InformationLetterModal).
// Wording comes from the project's approved letter: change it only when the
// letter itself changes.

export type LetterSection = {
  heading: string;
  /** Plain paragraphs, shown first. */
  paragraphs?: string[];
  /** A bullet list, shown after the paragraphs. */
  bullets?: string[];
  /** A link shown last, as plain text that is also the href. */
  link?: string;
};

export const LETTER_TITLE = "Information letter";
export const LETTER_QUESTION =
  "Would you like to participate in the research project AI for Open Science?";

export const letterSections: LetterSection[] = [
  {
    heading: "Purpose",
    bullets: [
      "The AI for Open Science (AIOS) is an Erasmus+ project that is creating a curriculum for open science officers, including teaching on the use of AI for open science.",
      "Collected personal data will be used for us to research on the effectiveness of this curriculum.",
    ],
  },
  {
    heading: "Why are we asking you to participate?",
    paragraphs: [
      "We are asking you to participate because we think you may be interested in the topic of the AIOS curriculum. We obtained your contact details either from existing previous contacts or because you reached out to us following public dissemination of the project.",
    ],
  },
  {
    heading: "Who is responsible?",
    paragraphs: [
      "NTNU is responsible for the personal data processed in the project (data controller).",
    ],
  },
  {
    heading: "What does participation involve?",
    bullets: [
      "Participants fill out an online “self-assessment” regarding their knowledge of Open Science practices and topics. The self-assessment collects professional-related information, such as your institution, your professional role, and your years of experience.",
      "If you enroll in the AIOS curriculum, logging in to the curriculum software will require some contact information and a unique identifier; this information will be connected for technical reasons only and will not be used for research.",
      "If you complete the curriculum, we will ask you to complete the self-assessment questionnaire again at a later time, and we will keep track of your progress.",
    ],
  },
  {
    heading: "Voluntary participation",
    paragraphs: [
      "Your participation in the project is voluntary. There will be no negative consequences if you choose not to participate, or if you later ask for your personal data to be deleted.",
    ],
  },
  {
    heading: "Your rights",
    paragraphs: [
      "So long as you can be identified, you have the right to request access to data about you, and request that we correct or delete your personal data. You also have the right to lodge a complaint with the Norwegian Data Protection Authority (Datatilsynet). Read more here:",
    ],
    link: "https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en",
  },
  {
    heading: "Use of personal data",
    paragraphs: [
      "We will only use your personal data for the purposes described in this information. We will process your personal data confidentially and in accordance with data protection legislation.",
      "Only the project group at NTNU and the online survey provider will have access to your survey information.",
    ],
  },
  {
    heading: "Legal basis for processing personal data",
    paragraphs: [
      "We process your personal data based on your consent. You are free to withdraw your consent at any time.",
    ],
  },
  {
    heading: "What happens to your personal data at the end of the project?",
    paragraphs: [
      "Your personal data will be anonymised when the project is completed, according to plan in March 2028.",
    ],
  },
  {
    heading: "Contact information",
    bullets: [
      "Project leader: Leonardo Montecchi, Associate Professor, leonardo.montecchi@ntnu.no",
      "Data Protection Officer at the data controller: Thomas Helgesen, thomas.helgesen@ntnu.no.",
      "Sikt – Norwegian Agency for Shared Services in Education and Research has assessed that the processing of personal data in this project is in accordance with data protection legislation. For questions about the assessment: personverntjenester@sikt.no",
    ],
  },
  {
    heading: "Consent to participate",
    paragraphs: [
      "I have received information about the project AI for Open Science and consent to participate.",
    ],
  },
];
