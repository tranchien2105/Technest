import { CreditCard, Headphones, ShieldCheck, Truck } from "lucide-react";

export default function ServiceSection({ t }) {
  return (
    <section className="service-strip unified-section">
      <div className="service-item">
        <span>
          <Truck size={22} />
        </span>
        <div>
          <strong>{t.delivery}</strong>
          <small>{t.deliveryDesc}</small>
        </div>
      </div>
      <div className="service-item">
        <span>
          <ShieldCheck size={22} />
        </span>
        <div>
          <strong>{t.authentic}</strong>
          <small>{t.authenticDesc}</small>
        </div>
      </div>
      <div className="service-item">
        <span>
          <Headphones size={22} />
        </span>
        <div>
          <strong>{t.support}</strong>
          <small>{t.supportDesc}</small>
        </div>
      </div>
      <div className="service-item">
        <span>
          <CreditCard size={22} />
        </span>
        <div>
          <strong>{t.payment}</strong>
          <small>{t.paymentDesc}</small>
        </div>
      </div>
    </section>
  );
}
