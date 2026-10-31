// Section outlines for the legal pages. Paste your text into each `body`
// (an array of paragraphs). Have a lawyer review before going live.

const s = (heading, subsections = []) => ({
  heading,
  body: ['Section text goes here.'],
  subsections: subsections.map((h) => ({ heading: h, body: ['Section text goes here.'] })),
})

export const legal = {
  privacy: {
    title: 'Privacy Policy',
    updated: '[Date]',
    intro: [],
    sections: [
      s('1. Information We Collect', ['1.1 Demo Submissions', '1.2 Information Collected Automatically']),
      s('2. How We Use Your Information'),
      s('3. How We Share Your Information'),
      s('4. Data Retention'),
      s('5. Your Rights and Choices'),
      s('6. Data Security'),
      s("7. Children's Privacy"),
      s('8. Changes to This Policy'),
      s('9. Contact Us'),
    ],
  },
  terms: {
    title: 'Terms of Service',
    updated: '[Date]',
    intro: [],
    sections: [
      s('1. Introduction'),
      s('2. Use of the Site'),
      s('3. Demo Submissions', ['3.1 Ownership of Submitted Music', '3.2 No Obligation to Sign']),
      s('4. Intellectual Property'),
      s('5. Third-Party Links'),
      s('6. Disclaimers'),
      s('7. Limitation of Liability'),
      s('8. Changes to These Terms'),
      s('9. Governing Law'),
      s('10. Contact'),
    ],
  },
}
