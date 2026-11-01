import { TrendingUp } from "lucide-react";

const searches = [
  "Bàn phím cơ",
  "Keychron K2 Pro",
  "Bàn phím không dây",
  "Chuột Logitech",
  "Chuột gaming không dây",
  "Màn hình QHD",
  "Màn hình 27 inch",
  "Tai nghe chống ồn",
  "Tai nghe Bluetooth",
  "Sony WH-1000XM5",
  "Loa Bluetooth",
  "Webcam Full HD",
  "Hub USB-C",
  "Sạc GaN USB-C",
  "Lót chuột gaming",
  "Micro USB",
  "Keychron K8 Pro",
  "Logitech MX Master 3S",
  "Bàn phím 75%",
  "Màn hình gaming",
  "Tai nghe gaming",
  "Phụ kiện setup bàn làm việc",
  "JBL Flip 6",
  "Sony WF-C700N",
  "Bàn phím văn phòng",
  "Giá đỡ màn hình",
  "Cáp sạc USB-C",
  "Chuột Bluetooth",
  "Màn hình 4K",
  "Tai nghe có micro",
  "Bộ setup góc làm việc",
  "Phụ kiện máy tính",
];

export default function HomePopularSearches({ language, navigate, setSearch, cms }) {
  const vi = language === "vi";

  const searchFor = (term) => {
    setSearch(term);
    navigate(`/search?q=${encodeURIComponent(term)}`);
  };

  return (
    <section className="home-popular-searches" aria-labelledby="home-popular-searches-title">
      <h2 id="home-popular-searches-title">
        <TrendingUp size={24} aria-hidden="true" />
        {cms?.title ?? (vi ? "Mọi người cũng tìm kiếm" : "Popular searches")}
      </h2>
      <div className="home-popular-search-tags">
        {searches.map((term) => (
          <button key={term} type="button" onClick={() => searchFor(term)}>
            {term}
          </button>
        ))}
      </div>
    </section>
  );
}
