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

// Continue in the order of the owner's complete vowel chart. The same paths
// drive both the animated pencil and coverage validation.
const headline: WritingStroke = {path:'M98 80 L183 80',start:[98,80],instruction:'Lift the pencil and draw the headline from left to right.'};
const upperMark: WritingStroke = {path:'M160 79 C154 59 138 47 121 43',start:[160,79],instruction:'Lift the pencil. From the headline, curve upward and left to add the vowel mark.'};
const secondUpperMark: WritingStroke = {path:'M191 79 C183 55 167 42 151 37',start:[191,79],instruction:'Lift again. Add the second upward curve beside the first.'};
// Keep each pen-down stroke separate so the starting-dot tutorial is accurate.
const eStrokes: WritingStroke[] = [
  {path:'M117 80 L117 115 C116 131 135 143 151 146 L166 172',start:[117,80],instruction:'Start at the left stem. Move down and sweep right into the lower tail.'},
  {path:'M163 80 L163 119 C163 137 151 141 141 140',start:[163,80],instruction:'Lift the pencil. Draw the right stem down and curve left into the body.'},
  headline,
];
const aaStrokes = writingLessons[1].strokes;
const aStrokes = writingLessons[0].strokes;
const dot = (x:number,y:number):WritingStroke => ({path:`M${x} ${y} L${x+.5} ${y}`,start:[x,y],instruction:'Lift the pencil. Touch down briefly to make this dot.'});
const riStrokes: WritingStroke[] = [
  {path:'M91 80 C122 76 138 87 129 102 C123 111 110 115 101 119 C128 123 139 141 151 156 L164 174',start:[91,80],instruction:'Begin under the headline. Curve right, return toward the middle, and sweep diagonally down to the right.'},
  {path:'M138 107 L183 107 C198 107 198 127 184 132 L163 132 C183 134 196 145 189 160 C182 173 162 171 152 162',start:[138,107],instruction:'Lift the pencil. Draw the right-hand loop, then continue into its lower curve.'},
  {path:'M77 80 L205 80',start:[77,80],instruction:'Finish with the headline, from left to right.'},
];
writingLessons.push(
  {letter:'ऊ',strokes:[...writingLessons[4].strokes.slice(0,1),{path:'M161 118 C188 111 194 126 183 136 C174 143 187 157 202 151',start:[161,118],instruction:'Lift your pencil. Add the small right-hand curl, curving out and back.'},headline]},
  {letter:'ए',strokes:eStrokes},
  {letter:'ऐ',strokes:[...eStrokes,upperMark]},
  {letter:'ओ',strokes:[...aaStrokes,upperMark]},
  {letter:'औ',strokes:[...aaStrokes,upperMark,secondUpperMark]},
  {letter:'अं',strokes:[...aStrokes,dot(164,52)]},
  {letter:'अः',strokes:[...aStrokes,dot(205,115),dot(205,151)]},
  {letter:'ऋ',strokes:riStrokes},
  {letter:'ॠ',strokes:[...riStrokes,{path:'M196 112 C219 106 223 126 209 137 C198 145 207 163 220 160',start:[196,112],instruction:'Lift the pencil. Add the outer curl on the right for ॠ.'}]},
);
