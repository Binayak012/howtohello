/** Original simplified handwriting paths, shared by the tutorial and its trace target.
 * Sequence reference: Central Hindi Directorate, Deskbook on Orthography of
 * Devanagari Script (2019), vowel-writing unit; see website/README.md.
 */
export type WritingStroke = { path: string; start: [number, number]; instruction: string };
export type WritingLesson = { letter: string; strokes: WritingStroke[] };
const aBody: WritingStroke = { path: 'M86 91 C113 70 132 96 113 113 L101 121 C135 114 141 152 114 164 C99 170 86 158 80 149', start: [86, 91], instruction: 'Start at the upper left. Curve right and down, then make the second lower curve.' };
const iBody: WritingStroke = { path: 'M158 79 L158 101 L130 101 C99 101 99 133 124 134 L143 132 C176 131 170 163 143 171 C125 176 113 163 122 157 C133 152 145 177 159 189', start: [158, 79], instruction: 'Start at the upper right. Move down, curve left, then sweep through the lower loop and tail.' };
export const writingLessons: WritingLesson[] = [
  { letter: 'अ', strokes: [aBody,
    { path: 'M105 123 L169 123', start: [105, 123], instruction: 'Lift your pencil. Draw the short connecting line from the middle toward the right.' },
    { path: 'M169 79 L169 175', start: [169, 79], instruction: 'Lift again. Draw the right-hand stem from top to bottom.' },
    { path: 'M146 79 L190 79', start: [146, 79], instruction: 'Finish with the short headline, moving from left to right above the stem.' },
  ] },
  { letter: 'आ', strokes: [
    { path: 'M66 91 C93 70 112 96 93 113 L81 121 C115 114 121 152 94 164 C79 170 66 158 60 149', start: [66, 91], instruction: 'Begin with the same two downward curves as अ.' },
    { path: 'M85 123 L145 123', start: [85, 123], instruction: 'Lift your pencil and connect the middle of the curves to the right.' },
    { path: 'M145 79 L145 175', start: [145, 79], instruction: 'Draw the first straight stem from top to bottom.' },
    { path: 'M194 79 L194 175', start: [194, 79], instruction: 'Lift your pencil. Add a second straight stem farther to the right.' },
    { path: 'M124 79 L215 79', start: [124, 79], instruction: 'Join the two stems with a headline drawn from left to right.' },
  ] },
  { letter: 'इ', strokes: [iBody,
    { path: 'M112 79 L181 79', start: [112, 79], instruction: 'Lift your pencil. Finish the headline from left to right.' },
  ] },
  { letter: 'ई', strokes: [iBody,
    { path: 'M158 79 C152 64 135 49 144 38 C152 28 166 34 168 43', start: [158, 79], instruction: 'Lift your pencil. Begin above the stem and curl upward into the small top hook.' },
    { path: 'M112 79 L181 79', start: [112, 79], instruction: 'Finish with the headline from left to right, below the hook.' },
  ] },
  { letter: 'उ', strokes: [
    { path: 'M108 80 C144 79 164 90 157 109 C153 121 138 126 121 126 C151 117 178 137 169 158 C158 181 120 178 106 153', start: [108, 80], instruction: 'Start near the upper left. Sweep right into the top curve, then continue through the wider lower curve.' },
    { path: 'M98 80 L183 80', start: [98, 80], instruction: 'Lift your pencil and finish with the headline from left to right.' },
  ] },
];
