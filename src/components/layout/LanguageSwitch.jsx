export default function LanguageSwitch({ language, setLanguage }) {
  return (
    <div className="language-switch" aria-label="Language">
      <button
        className={language === "vi" ? "active" : ""}
        onClick={() => setLanguage("vi")}
        aria-pressed={language === "vi"}
      >
        VI
      </button>
      <span>/</span>
      <button
        className={language === "en" ? "active" : ""}
        onClick={() => setLanguage("en")}
        aria-pressed={language === "en"}
      >
        EN
      </button>
    </div>
  );
}
