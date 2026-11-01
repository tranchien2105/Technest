import { ArrowLeft } from "lucide-react";
import { PageTitle } from "../components/store/PageElements";
import { tx } from "../utils/translate";
export default function NotFoundPage({ language, navigate }) {
  const lang = language === "vi";
  return (
    <section className="store-page narrow-page">
      <PageTitle
        title={tx("Page not found", "Không tìm thấy trang", lang)}
        desc={tx(
          "The page you’re looking for isn’t here.",
          "Trang bạn đang tìm không tồn tại.",
          lang,
        )}
      />
      <button className="primary-button" onClick={() => navigate("/")}>
        {tx("Back to home", "Về trang chủ", lang)} <ArrowLeft size={16} />
      </button>
    </section>
  );
}
