# Language recipes

Per-language setup for `polyglossia` + `fontspec` under **XeLaTeX**. Each entry
gives: the polyglossia declaration, a font candidate chain (TeX Live-shipped
first, then Noto, then OS fonts), a real sample sentence in the language's own
script (UTF-8), and gotchas.

Conventions used below:

- `\setdefaultlanguage` for the document's primary language; `\setotherlanguage`
  for secondaries.
- Guard every preferred font with `\IfFontExistsTF` so the document still
  compiles when the font is missing.
- Switch language inline with `\text<lang>{…}` and in blocks with the
  `\begin{<lang>}…\end{<lang>}` environment polyglossia defines.
- Never load `bidi` by hand; polyglossia loads it last for RTL scripts.

The generic guarded-font macro pattern (substitute family names from the chain):

```latex
\IfFontExistsTF{<Preferred>}
  {\setmainfont{<Preferred>}}
  {\IfFontExistsTF{<Fallback1>}{\setmainfont{<Fallback1>}}{\setmainfont{<Fallback2>}}}
```

---

## English

- **polyglossia:** `\setdefaultlanguage{english}` (or
  `\setdefaultlanguage[variant=british]{english}`).
- **Script:** Latin. **Fonts:** CMU Serif → Noto Serif → TeX Gyre Termes →
  DejaVu Serif.
- **Preamble:**
  ```latex
  \setdefaultlanguage{english}
  \IfFontExistsTF{CMU Serif}{\setmainfont{CMU Serif}}{\setmainfont{TeX Gyre Termes}}
  ```
- **Sample:** The quick brown fox jumps over the lazy dog.
- **Gotchas:** Use `\enquote{…}` from `csquotes` rather than literal `` `` '' ``
  so quote style follows the active language.

## German (Deutsch)

- **polyglossia:** `\setotherlanguage{german}` (or
  `\setdefaultlanguage[variant=german,spelling=new]{german}`).
- **Script:** Latin (umlauts ä ö ü, ß). **Fonts:** CMU Serif → Noto Serif →
  TeX Gyre Termes.
- **Preamble:**
  ```latex
  \setdefaultlanguage[variant=german,spelling=new]{german}
  ```
- **Sample:** Zwölf Boxkämpfer jagen Viktor quer über den großen Sylter Deich.
- **Gotchas:** German `\enquote` yields „low-high“ quotes. Hyphenation patterns
  matter for long compounds — keep the `german` variant correct.

## French (Français)

- **polyglossia:** `\setotherlanguage{french}`.
- **Script:** Latin (accents é è ê ç à). **Fonts:** CMU Serif → Noto Serif →
  TeX Gyre Termes.
- **Preamble:**
  ```latex
  \setotherlanguage{french}
  ```
- **Sample:** Portez ce vieux whisky au juge blond qui fume sur son île intérieure.
- **Gotchas:** French adds thin spaces before `;:!?` and uses guillemets
  « … » — `\enquote` and polyglossia handle this automatically; do not insert
  manual spaces.

## Spanish (Español)

- **polyglossia:** `\setotherlanguage{spanish}`.
- **Script:** Latin (ñ, ¿ ¡, accents). **Fonts:** CMU Serif → Noto Serif →
  TeX Gyre Termes.
- **Preamble:**
  ```latex
  \setotherlanguage{spanish}
  ```
- **Sample:** El veloz murciélago hindú comía feliz cardillo y kiwi.
- **Gotchas:** Inverted `¿` `¡` are literal UTF-8 characters under XeLaTeX — no
  special macro needed.

## Italian (Italiano)

- **polyglossia:** `\setotherlanguage{italian}`.
- **Script:** Latin (à è é ì ò ù). **Fonts:** CMU Serif → Noto Serif →
  TeX Gyre Termes.
- **Preamble:**
  ```latex
  \setotherlanguage{italian}
  ```
- **Sample:** Ma la volpe, col suo balzo, ha raggiunto il quieto Fido.
- **Gotchas:** Accented vowels are UTF-8 literals; nothing special required.

## Portuguese (Português)

- **polyglossia:** `\setotherlanguage{portuguese}` (Brazilian:
  `\setotherlanguage[variant=brazilian]{portuguese}`).
- **Script:** Latin (ã õ ç á â). **Fonts:** CMU Serif → Noto Serif →
  TeX Gyre Termes.
- **Preamble:**
  ```latex
  \setotherlanguage[variant=brazilian]{portuguese}
  ```
- **Sample:** Um pequeno jabuti xereta viu dez cegonhas felizes.
- **Gotchas:** Choose the `brazilian` vs European variant for hyphenation.

## Serbian — Cyrillic (Српски, ћирилица)

- **polyglossia:** `\setotherlanguage[script=cyrillic]{serbian}` (or as default
  `\setdefaultlanguage[script=cyrillic]{serbian}`).
- **Script:** Cyrillic. **Fonts:** CMU Serif (full Cyrillic coverage) → Noto
  Serif → DejaVu Serif.
- **Preamble:**
  ```latex
  \setotherlanguage[script=cyrillic]{serbian}
  \newfontfamily\serbianfont[Script=Cyrillic]{CMU Serif}
  ```
- **Sample:** Љубазни фењерџија чађавог лица хоће да ми покаже штос.
- **Gotchas:** Serbian uses distinct letterforms (italic б г д п т differ from
  Russian) — prefer a font with Serbian locale shaping (`Language=Serbian` if
  the font supports it). Keep Cyrillic and Latin Serbian as separate font
  families if both scripts appear.

## Serbian — Latin (Srpski, latinica)

- **polyglossia:** `\setotherlanguage[script=latin]{serbian}`.
- **Script:** Latin with diacritics (č ć š ž đ). **Fonts:** CMU Serif → Noto
  Serif → TeX Gyre Termes.
- **Preamble:**
  ```latex
  \setotherlanguage[script=latin]{serbian}
  ```
- **Sample:** Fijuče vetar u šiblju, ledi pasaže i kuće iza njih i gunđa u dimnjacima.
- **Gotchas:** The digraph dž/lj/nj are normal letters; no ligature macros
  needed. When both Serbian scripts appear, switch with two `\setotherlanguage`
  declarations is not possible for the same name — instead set one as default
  and use a dedicated font family + manual `\textserbian`/`\selectlanguage` for
  the other, or define a custom language alias.

## Russian (Русский)

- **polyglossia:** `\setotherlanguage{russian}` (or default
  `\setdefaultlanguage{russian}`).
- **Script:** Cyrillic. **Fonts:** CMU Serif → Noto Serif → DejaVu Serif.
- **Preamble:**
  ```latex
  \setotherlanguage{russian}
  \newfontfamily\russianfont[Script=Cyrillic]{CMU Serif}
  ```
- **Sample:** Съешь же ещё этих мягких французских булок да выпей чаю.
- **Gotchas:** When Russian is the main language, set `\setmainfont` to a
  Cyrillic-capable face too, not just `\russianfont`.

## Ukrainian (Українська)

- **polyglossia:** `\setotherlanguage{ukrainian}`.
- **Script:** Cyrillic (adds ґ є і ї, no ы ъ э). **Fonts:** CMU Serif → Noto
  Serif → DejaVu Serif.
- **Preamble:**
  ```latex
  \setotherlanguage{ukrainian}
  \newfontfamily\ukrainianfont[Script=Cyrillic]{CMU Serif}
  ```
- **Sample:** Чуєш їх, доцю, га? Кумедна ж ти, прощайся без ґольфів!
- **Gotchas:** Distinct apostrophe usage (ʼ) — keep the UTF-8 modifier-letter
  apostrophe, not a straight quote.

## Greek (Ελληνικά)

- **polyglossia:** `\setotherlanguage{greek}` (variants:
  `[variant=monotonic]` or `[variant=polytonic]`).
- **Script:** Greek. **Fonts:** CMU Serif → GFS Didot → Noto Serif.
- **Preamble:**
  ```latex
  \setotherlanguage[variant=monotonic]{greek}
  \newfontfamily\greekfont[Script=Greek]{CMU Serif}
  ```
- **Sample:** Ξεσκεπάζω την ψυχοφθόρα βδελυγμία.
- **Gotchas:** Use polytonic variant only for classical texts (it expects
  breathing/accent diacritics). Final sigma ς is handled by the font; type it
  literally.

## Arabic (العربية)

- **polyglossia:** `\setotherlanguage{arabic}` (RTL).
- **Script:** Arabic. **Fonts:** Amiri → Noto Naskh Arabic → Scheherazade New.
- **Preamble:**
  ```latex
  \setotherlanguage{arabic}
  \IfFontExistsTF{Amiri}
    {\newfontfamily\arabicfont[Script=Arabic]{Amiri}}
    {\IfFontExistsTF{Noto Naskh Arabic}
       {\newfontfamily\arabicfont[Script=Arabic]{Noto Naskh Arabic}}
       {\newfontfamily\arabicfont[Script=Arabic]{Scheherazade New}}}
  ```
- **Sample:** نص حكيم له سر قاطع وذو شأن عظيم مكتوب على ثوب أخضر ومغلف بجلد أزرق.
- **Gotchas:** RTL — never load `bidi` manually; polyglossia handles direction
  and loads bidi last. Switch with `\begin{arabic}…\end{arabic}` or
  `\textarabic{…}`. Arabic-Indic digits via the font/`Numbers` option.

## Hebrew (עברית)

- **polyglossia:** `\setotherlanguage{hebrew}` (RTL).
- **Script:** Hebrew. **Fonts:** Noto Serif Hebrew → David CLM → Frank Ruehl CLM.
- **Preamble:**
  ```latex
  \setotherlanguage{hebrew}
  \IfFontExistsTF{Noto Serif Hebrew}
    {\newfontfamily\hebrewfont[Script=Hebrew]{Noto Serif Hebrew}}
    {\newfontfamily\hebrewfont[Script=Hebrew]{David CLM}}
  ```
- **Sample:** דג סקרן שט בים מאוכזב ולפתע מצא חברה.
- **Gotchas:** RTL, same bidi rule as Arabic. Niqqud (vowel points) require a
  font that carries them; most prose omits them.

## Persian (فارسی)

- **polyglossia:** `\setotherlanguage{persian}` (alias `farsi`, RTL).
- **Script:** Arabic script (adds پ چ ژ گ, uses ی and ک). **Fonts:** Amiri →
  Noto Naskh Arabic → Scheherazade New. (For authentic Persian shaping prefer
  a Nastaliq face if available, e.g. Noto Nastaliq Urdu.)
- **Preamble:**
  ```latex
  \setotherlanguage{persian}
  \newfontfamily\persianfont[Script=Arabic]{Amiri}
  ```
- **Sample:** ای کاش زندگی همانند گلی زیبا و معطر در باغ آرزوها شکوفا شود.
- **Gotchas:** RTL bidi rule as above. Persian uses ZWNJ (zero-width
  non-joiner) inside words — keep the literal UTF-8 U+200C; do not strip it.

## Turkish (Türkçe)

- **polyglossia:** `\setotherlanguage{turkish}`.
- **Script:** Latin with dotted/dotless i (i ı İ I), ş ğ ç ö ü. **Fonts:** CMU
  Serif → Noto Serif → TeX Gyre Termes.
- **Preamble:**
  ```latex
  \setotherlanguage{turkish}
  ```
- **Sample:** Pijamalı hasta yağız şoföre çabucak güvendi.
- **Gotchas:** The dotted/dotless i distinction is significant — preserve the
  exact characters (ı U+0131, İ U+0130). Turkish casing rules differ; avoid
  forcing `\MakeUppercase` on dotted i.

## Chinese — Simplified (简体中文)

- **xeCJK + polyglossia.** Load `xeCJK`; polyglossia is optional for CJK.
- **Script:** Han (simplified). **Fonts:** FandolSong → Noto Serif CJK SC →
  Source Han Serif SC.
- **Preamble:**
  ```latex
  \usepackage{xeCJK}
  \IfFontExistsTF{FandolSong}
    {\setCJKmainfont{FandolSong}}
    {\setCJKmainfont{Noto Serif CJK SC}}
  ```
- **Sample:** 视频编码技术正在快速发展，国际标准也在不断更新。
- **Gotchas:** Use `xeCJK` (not polyglossia alone) for proper CJK line
  breaking and punctuation kerning. FandolSong ships with TeX Live. Mixed
  CJK/Latin spacing is handled by xeCJK's `\xeCJKsetup`.

## Japanese (日本語)

- **xeCJK.** **Fonts:** HaranoAjiMincho → Noto Serif CJK JP → IPAexMincho.
- **Preamble:**
  ```latex
  \usepackage{xeCJK}
  \IfFontExistsTF{HaranoAjiMincho}
    {\setCJKmainfont{HaranoAjiMincho}}
    {\setCJKmainfont{Noto Serif CJK JP}}
  ```
- **Sample:** いろはにほへと ちりぬるを 色は匂へど 散りぬるを。
- **Gotchas:** Mixes kanji + hiragana + katakana in one font. For heavy
  Japanese typesetting consider `bxjsarticle`/`luatexja`, but xeCJK is fine for
  occasional passages. HaranoAjiMincho ships with TeX Live.

## Korean (한국어)

- **xeCJK.** **Fonts:** NanumMyeongjo → Noto Serif CJK KR → UnBatang.
- **Preamble:**
  ```latex
  \usepackage{xeCJK}
  \IfFontExistsTF{NanumMyeongjo}
    {\setCJKmainfont{NanumMyeongjo}}
    {\setCJKmainfont{Noto Serif CJK KR}}
  ```
- **Sample:** 다람쥐 헌 쳇바퀴에 타고파.
- **Gotchas:** Hangul allows line breaks between syllable blocks; xeCJK manages
  this. Spacing between words (Korean uses spaces, unlike Chinese/Japanese) is
  preserved normally.

## Hindi (हिन्दी, Devanagari)

- **polyglossia:** `\setotherlanguage{hindi}`.
- **Script:** Devanagari. **Fonts:** Noto Serif Devanagari → Shobhika →
  Lohit Devanagari.
- **Preamble:**
  ```latex
  \setotherlanguage{hindi}
  \IfFontExistsTF{Noto Serif Devanagari}
    {\newfontfamily\hindifont[Script=Devanagari]{Noto Serif Devanagari}}
    {\newfontfamily\hindifont[Script=Devanagari]{Shobhika}}
  ```
- **Sample:** ऋषियों को सताने वाले दुष्ट राक्षसों के राजा रावण का सर्वनाश करने वाले विष्णुवतार भगवान श्रीराम।
- **Gotchas:** Devanagari needs `Script=Devanagari` so XeTeX applies the
  conjunct/ligature shaping (otherwise consonant clusters render wrong).
  Shobhika ships with TeX Live and has strong Devanagari coverage.
