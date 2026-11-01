import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { OrderEmailEvent, OrderEmailPayload } from "../order-email.types.js";

interface OrderEmailProps {
  event: OrderEmailEvent;
  payload: OrderEmailPayload;
  customerName: string;
  orderUrl: string;
  supportEmail: string;
  supportName: string;
}

const palette = {
  accent: "#ff5a00",
  background: "#efefed",
  card: "#ffffff",
  text: "#171717",
  muted: "#444444",
  border: "#b8b8b4",
};

const messages: Record<OrderEmailEvent, { subject: string; title: string; message: string }> = {
  ORDER_PLACED: {
    subject: "Xác nhận đơn hàng",
    title: "Đặt hàng thành công!",
    message: "Technest đã tiếp nhận đơn hàng của bạn. Chúng tôi sẽ cập nhật khi đơn được xác nhận.",
  },
  ORDER_CONFIRMED: {
    subject: "Đơn hàng đã được xác nhận",
    title: "Đơn hàng đã được xác nhận",
    message: "Đơn hàng đang được chuẩn bị. Technest sẽ tiếp tục cập nhật khi trạng thái thay đổi.",
  },
  ORDER_PROCESSING: {
    subject: "Đơn hàng đang được chuẩn bị",
    title: "Đơn hàng đang được chuẩn bị",
    message: "Technest đang chuẩn bị sản phẩm cho đơn hàng của bạn.",
  },
  ORDER_SHIPPED: {
    subject: "Đơn hàng đang trên đường đến bạn",
    title: "Đơn hàng đang trên đường đến bạn!",
    message: "Đơn hàng đã được chuyển sang trạng thái đang giao.",
  },
  ORDER_DELIVERED: {
    subject: "Đơn hàng đã được giao thành công",
    title: "Đơn hàng đã được giao thành công!",
    message: "Cảm ơn bạn đã mua sắm tại Technest. Chúc bạn có trải nghiệm tuyệt vời với sản phẩm.",
  },
  ORDER_CANCELLED: {
    subject: "Đơn hàng đã được hủy",
    title: "Đơn hàng đã được hủy",
    message:
      "Đơn hàng này đã được chuyển sang trạng thái đã hủy. Nếu cần hỗ trợ, vui lòng liên hệ Technest.",
  },
};

const money = (value: string) =>
  `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(BigInt(value))} ₫`;

const date = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));

const cell: React.CSSProperties = {
  padding: "16px 12px",
  verticalAlign: "middle",
};

export function orderEmailSubject(event: OrderEmailEvent, orderNumber: string) {
  return `Technest | ${messages[event].subject} #${orderNumber}`;
}

export function OrderEmail({
  event,
  payload,
  customerName,
  orderUrl,
  supportEmail,
  supportName,
}: OrderEmailProps) {
  const content = messages[event];
  const address = payload.shippingAddress;
  const shipment = payload.shipment;

  return (
    <Html lang="vi">
      <Head>
        <style>{`@media only screen and (max-width: 480px) {
          .email-content { padding: 24px 16px !important; }
          .email-product-cell { padding: 10px 6px !important; }
          .email-product-image { width: 48px !important; height: 48px !important; }
          .email-product-media { width: 48px !important; }
        }`}</style>
      </Head>
      <Preview>{`${content.title} · Đơn hàng #${payload.orderNumber}`}</Preview>
      <Body
        style={{
          margin: 0,
          padding: "28px 12px",
          backgroundColor: palette.background,
          fontFamily: "Arial, Helvetica, sans-serif",
          color: palette.text,
        }}
      >
        <Container style={{ width: "100%", maxWidth: "640px", margin: "0 auto" }}>
          <Section style={{ padding: "8px 0 18px" }}>
            <Text
              style={{
                margin: 0,
                color: palette.text,
                fontSize: "26px",
                fontWeight: 800,
                letterSpacing: "-1px",
              }}
            >
              Technest<span style={{ color: palette.accent }}>.</span>
            </Text>
            <Text style={{ margin: "4px 0 0", color: palette.muted, fontSize: "12px" }}>
              THÔNG BÁO ĐƠN HÀNG
            </Text>
          </Section>

          <Section
            className="email-content"
            style={{
              padding: "30px 28px",
              backgroundColor: palette.card,
              border: `2px solid ${palette.border}`,
              borderTop: `5px solid ${palette.text}`,
            }}
          >
            <Text
              style={{
                margin: "0 0 8px",
                color: palette.accent,
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "1px",
                textTransform: "uppercase",
              }}
            >
              CẬP NHẬT ĐƠN HÀNG
            </Text>
            <Heading
              as="h1"
              style={{
                margin: "0 0 12px",
                color: palette.text,
                fontSize: "26px",
                fontWeight: 800,
                lineHeight: "34px",
              }}
            >
              {content.title}
            </Heading>
            <Text
              style={{
                margin: "0 0 22px",
                color: palette.muted,
                fontSize: "15px",
                lineHeight: "24px",
              }}
            >
              Xin chào {customerName || "bạn"}, {content.message}
            </Text>

            <Section
              style={{
                padding: "16px 18px",
                border: `1px solid ${palette.border}`,
                borderLeft: `4px solid ${palette.accent}`,
                backgroundColor: "#f6f6f3",
              }}
            >
              <Text
                style={{
                  margin: 0,
                  color: palette.muted,
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "1px",
                }}
              >
                MÃ ĐƠN HÀNG
              </Text>
              <Text
                style={{
                  margin: "5px 0 0",
                  color: palette.text,
                  fontSize: "18px",
                  fontWeight: 800,
                }}
              >
                #{payload.orderNumber}
              </Text>
              <Text style={{ margin: "7px 0 0", color: palette.muted, fontSize: "12px" }}>
                Ngày đặt: {date(payload.createdAt)}
              </Text>
            </Section>

            {event === "ORDER_PLACED" && (
              <>
                <Heading
                  as="h2"
                  style={{ margin: "26px 0 12px", fontSize: "17px", fontWeight: 800 }}
                >
                  Chi tiết sản phẩm
                </Heading>
                <table
                  width="100%"
                  cellPadding="0"
                  cellSpacing="0"
                  role="presentation"
                  style={{ borderCollapse: "collapse", fontSize: "12px" }}
                >
                  <tbody>
                    {payload.items.map((item, index) => (
                      <tr key={`${item.sku}-${index}`}>
                        <td style={{ padding: "0 4px 14px 0" }}>
                          <table
                            role="presentation"
                            width="100%"
                            cellPadding="0"
                            cellSpacing="0"
                            style={{
                              border: `2px solid ${palette.border}`,
                              backgroundColor: "#fff",
                              boxShadow: "4px 4px 0 #deded8",
                            }}
                          >
                            <tbody>
                              <tr>
                                <td
                                  className="email-product-cell email-product-media"
                                  style={{ ...cell, width: "76px" }}
                                >
                                  {item.imageUrl ? (
                                    <Img
                                      className="email-product-image"
                                      src={item.imageUrl}
                                      width="72"
                                      height="72"
                                      alt={item.name}
                                      style={{
                                        objectFit: "contain",
                                        backgroundColor: "#f6f6f3",
                                        border: "1px solid #d5d5cf",
                                      }}
                                    />
                                  ) : (
                                    <div
                                      style={{
                                        width: "72px",
                                        padding: "23px 0",
                                        textAlign: "center",
                                        backgroundColor: palette.background,
                                        color: palette.muted,
                                        fontSize: "10px",
                                      }}
                                    >
                                      Chưa có ảnh
                                    </div>
                                  )}
                                </td>
                                <td className="email-product-cell" style={cell}>
                                  <Text
                                    style={{
                                      margin: 0,
                                      color: palette.text,
                                      fontSize: "14px",
                                      fontWeight: 800,
                                    }}
                                  >
                                    {item.name}
                                  </Text>
                                  <Text
                                    style={{
                                      margin: "5px 0 0",
                                      color: palette.muted,
                                      fontSize: "11px",
                                      lineHeight: "18px",
                                    }}
                                  >
                                    SKU: {item.sku || "—"} · SL: {item.quantity}
                                  </Text>
                                </td>
                                <td
                                  className="email-product-cell"
                                  align="right"
                                  style={{ ...cell, fontWeight: 800, fontSize: "13px" }}
                                >
                                  {money(
                                    (BigInt(item.unitPrice) * BigInt(item.quantity)).toString(),
                                  )}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Section style={{ paddingTop: "15px" }}>
                  <Text style={{ margin: "0 0 8px", color: palette.muted, fontSize: "13px" }}>
                    Tạm tính{" "}
                    <span style={{ float: "right", color: palette.text }}>
                      {money(payload.subtotal)}
                    </span>
                  </Text>
                  <Text style={{ margin: "0 0 8px", color: palette.muted, fontSize: "13px" }}>
                    Phí vận chuyển{" "}
                    <span style={{ float: "right", color: palette.text }}>
                      {money(payload.shipping)}
                    </span>
                  </Text>
                  {BigInt(payload.discount) > 0n && (
                    <Text style={{ margin: "0 0 8px", color: palette.muted, fontSize: "13px" }}>
                      Giảm giá{" "}
                      <span style={{ float: "right", color: palette.accent }}>
                        −{money(payload.discount)}
                      </span>
                    </Text>
                  )}
                  <Hr style={{ margin: "14px 0", borderTop: `2px solid ${palette.text}` }} />
                  <Text style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>
                    Tổng thanh toán{" "}
                    <span style={{ float: "right", color: palette.accent, fontSize: "18px" }}>
                      {money(payload.total)}
                    </span>
                  </Text>
                  <Text style={{ margin: "12px 0 0", color: palette.muted, fontSize: "12px" }}>
                    Phương thức thanh toán: Thanh toán khi nhận hàng (COD)
                  </Text>
                </Section>
                <Heading
                  as="h2"
                  style={{ margin: "25px 0 8px", fontSize: "17px", fontWeight: 800 }}
                >
                  Địa chỉ giao hàng
                </Heading>
                <Text
                  style={{ margin: 0, color: palette.muted, fontSize: "13px", lineHeight: "21px" }}
                >
                  {[
                    address.recipient,
                    address.phone,
                    address.line1,
                    address.line2,
                    address.ward,
                    address.district,
                    address.city,
                    address.postalCode,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Thông tin địa chỉ sẽ được cập nhật trong chi tiết đơn hàng."}
                </Text>
              </>
            )}

            {event === "ORDER_SHIPPED" && (shipment?.carrierName || shipment?.trackingNumber) && (
              <Section
                style={{
                  marginTop: "18px",
                  padding: "15px 17px",
                  border: `2px solid ${palette.border}`,
                  backgroundColor: palette.background,
                }}
              >
                {shipment.carrierName && (
                  <Text style={{ margin: "0 0 6px", fontSize: "13px" }}>
                    Đơn vị vận chuyển: {shipment.carrierName}
                  </Text>
                )}
                {shipment.trackingNumber && (
                  <Text style={{ margin: 0, fontSize: "13px" }}>
                    Mã vận đơn:{" "}
                    {shipment.trackingUrl ? (
                      <Link href={shipment.trackingUrl} style={{ color: palette.accent }}>
                        {shipment.trackingNumber}
                      </Link>
                    ) : (
                      shipment.trackingNumber
                    )}
                  </Text>
                )}
              </Section>
            )}

            <Section style={{ marginTop: "26px" }}>
              <Button
                href={orderUrl}
                style={{
                  display: "inline-block",
                  padding: "13px 20px",
                  border: `2px solid ${palette.text}`,
                  backgroundColor: palette.text,
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Xem đơn hàng
              </Button>
            </Section>
          </Section>

          <Section style={{ padding: "18px 8px", textAlign: "center" }}>
            <Text style={{ margin: "0 0 6px", color: palette.muted, fontSize: "12px" }}>
              Cần hỗ trợ? Liên hệ{" "}
              <Link href={`mailto:${supportEmail}`} style={{ color: palette.accent }}>
                {supportName}
              </Link>
              .
            </Text>
            <Text style={{ margin: 0, color: palette.muted, fontSize: "11px" }}>
              © {new Date().getFullYear()} Technest. Email giao dịch tự động, vui lòng không trả lời
              thư này.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
