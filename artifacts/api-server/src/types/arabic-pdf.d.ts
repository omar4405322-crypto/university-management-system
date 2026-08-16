declare module 'bidi-js' {
  export interface BidiFactory {
    getEmbeddingLevels(text: string, direction?: 'ltr' | 'rtl' | 'auto'): {
      levels: Uint8Array;
      paragraphs: { start: number; end: number; level: number }[];
    };
    getReorderedString(
      text: string,
      embeddingLevels: {
        levels: Uint8Array;
        paragraphs: { start: number; end: number; level: number }[];
      }
    ): string;
  }

  export default function bidiFactory(): BidiFactory;
}

declare module 'arabic-persian-reshaper' {
  const ArabicReshaper: {
    ArabicShaper: {
      convertArabic(text: string): string;
      convertArabicBack(text: string): string;
    };
    PersianShaper: {
      convertArabic(text: string): string;
      convertArabicBack(text: string): string;
    };
  };
  export default ArabicReshaper;
}
