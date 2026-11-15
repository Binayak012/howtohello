/** Teaching sequence supplied by the project's vowel chart. */
export const vowelOrder = ['अ','आ','इ','ई','उ','ऊ','ए','ऐ','ओ','औ','अं','अः','ऋ','ॠ'] as const;
export const firstVowels = vowelOrder.slice(0,5);
export const secondVowels = vowelOrder.slice(5,10);
export const extraVowels = vowelOrder.slice(10);
