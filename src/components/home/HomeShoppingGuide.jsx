import { ArrowRight, Search, Scale, ShieldCheck } from "lucide-react";

export default function HomeShoppingGuide({ language, cms }) {
  const vi = language === "vi";
  const steps = vi
    ? [
        { Icon: Search, title: "Tìm đúng món cần dùng", text: "Lọc theo danh mục, thương hiệu và mức giá." },
        { Icon: Scale, title: "So sánh trước khi chọn", text: "Đặt cạnh nhau tối đa 3 sản phẩm để cân nhắc." },
        { Icon: ShieldCheck, title: "Mua sắm an tâm", text: "Thông tin đơn hàng và hỗ trợ luôn rõ ràng." },
      ]
    : [
        { Icon: Search, title: "Find what you need", text: "Browse by category, brand and price." },
        { Icon: Scale, title: "Compare your options", text: "Compare up to 3 products side by side." },
        { Icon: ShieldCheck, title: "Shop with confidence", text: "Clear order updates and helpful support." },
      ];

  return (
    <section className="home-shopping-guide" aria-labelledby="home-shopping-guide-title">
      <div className="home-shopping-guide-heading">
        <span className="section-kicker">{cms?.eyebrow ?? (vi ? "MUA SẮM DỄ DÀNG HƠN" : "A BETTER WAY TO SHOP")}</span>
        <h2 id="home-shopping-guide-title">
          {cms?.title ?? (vi ? "Chọn thiết bị phù hợp, không mất thời gian" : "Choose the right gear with less guesswork")}
        </h2>
      </div>
      <div className="home-shopping-guide-steps">
        {steps.map(({ Icon, title, text }, index) => (
          <article className="home-shopping-guide-step" key={title}>
            <span className="home-shopping-guide-icon"><Icon size={20} /></span>
            <span className="home-shopping-guide-number">0{index + 1}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
        <a className="home-shopping-guide-link" href={cms?.ctaUrl ?? "/products"}>
          {cms?.ctaLabel ?? (vi ? "Khám phá sản phẩm" : "Explore products")} <ArrowRight size={17} />
        </a>
      </div>
    </section>
  );
}
