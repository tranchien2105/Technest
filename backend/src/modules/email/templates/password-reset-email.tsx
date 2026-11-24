import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface PasswordResetEmailProps {
  kind: "reset" | "changed";
  actionUrl: string;
  supportEmail: string;
}

export function PasswordResetEmail({
  kind,
  actionUrl,
  supportEmail,
}: PasswordResetEmailProps): React.ReactElement {
  const reset = kind === "reset";
  const title = reset ? "Đặt lại mật khẩu của bạn" : "Mật khẩu đã được cập nhật";
  return (
    <Html lang="vi">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light" />
        <style>{`@media only screen and (max-width: 600px) { .email-card { padding: 28px 22px !important; } .email-title { font-size: 27px !important; } .email-outer { padding: 24px 12px !important; } }`}</style>
      </Head>
      <Preview>
        {reset
          ? "Khôi phục tài khoản TechNest. Liên kết có hiệu lực trong 15 phút."
          : "Mật khẩu TechNest đã được thay đổi. Các phiên đăng nhập cũ đã được thu hồi."}
      </Preview>
      <Body
        style={{
          backgroundColor: "#f4f4f1",
          margin: 0,
          fontFamily: "Arial, Helvetica, sans-serif",
          color: "#191919",
        }}
      >
        <Section className="email-outer" style={{ padding: "48px 16px" }}>
          <Container style={{ maxWidth: "560px", margin: "0 auto" }}>
            <Section style={{ padding: "0 8px 24px" }}>
              <Text
                style={{
                  margin: 0,
                  fontSize: "25px",
                  fontWeight: 800,
                  letterSpacing: "-1px",
                  color: "#171717",
                }}
              >
                TechNest<span style={{ color: "#ff5a00" }}>.</span>
              </Text>
              <Text
                style={{
                  margin: "5px 0 0",
                  fontSize: "11px",
                  letterSpacing: "1.5px",
                  color: "#71716b",
                }}
              >
                BETTER TOOLS. BRIGHTER DAYS.
              </Text>
            </Section>
            <Section
              className="email-card"
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #e4e4de",
                borderTop: "4px solid #ff5a00",
                borderRadius: "12px",
                padding: "40px",
              }}
            >
              <Text
                style={{
                  margin: "0 0 16px",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "2px",
                  color: "#a43b00",
                }}
              >
                BẢO MẬT TÀI KHOẢN
              </Text>
              <Heading
                as="h1"
                className="email-title"
                style={{
                  margin: "0 0 20px",
                  fontSize: "32px",
                  lineHeight: "1.2",
                  fontWeight: 700,
                  letterSpacing: "-0.8px",
                  color: "#171717",
                }}
              >
                {title}
              </Heading>
              <Text
                style={{
                  margin: "0 0 16px",
                  fontSize: "15px",
                  lineHeight: "1.75",
                  color: "#52524d",
                }}
              >
                Xin chào,
              </Text>
              <Text
                style={{
                  margin: "0 0 24px",
                  fontSize: "15px",
                  lineHeight: "1.75",
                  color: "#52524d",
                }}
              >
                {reset
                  ? "TechNest nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Nhấn nút bên dưới để tạo mật khẩu mới."
                  : "Mật khẩu tài khoản TechNest của bạn vừa được thay đổi thành công. Các phiên đăng nhập cũ đã được thu hồi để bảo vệ tài khoản."}
              </Text>
              <Section
                style={{
                  marginBottom: "26px",
                  padding: "16px 18px",
                  backgroundColor: "#fff6ef",
                  borderLeft: "3px solid #ff5a00",
                  borderRadius: "4px",
                }}
              >
                <Text style={{ margin: 0, fontSize: "13px", lineHeight: "1.7", color: "#713718" }}>
                  <strong>
                    {reset ? "Có hiệu lực trong 15 phút" : "Bạn không thực hiện thay đổi này?"}
                  </strong>
                  <br />
                  {reset
                    ? "Liên kết chỉ sử dụng được một lần. Vui lòng không chia sẻ với người khác."
                    : "Hãy liên hệ bộ phận hỗ trợ ngay để được giúp bảo vệ tài khoản."}
                </Text>
              </Section>
              <Button
                href={actionUrl}
                style={{
                  backgroundColor: "#171717",
                  color: "#ffffff",
                  padding: "16px 28px",
                  borderRadius: "6px",
                  fontSize: "15px",
                  fontWeight: 700,
                  textDecoration: "none",
                  textAlign: "center",
                }}
              >
                {reset ? "Đặt lại mật khẩu" : "Đăng nhập TechNest"}
              </Button>
              <Text
                style={{
                  margin: "24px 0 0",
                  fontSize: "13px",
                  lineHeight: "1.75",
                  color: "#72726b",
                }}
              >
                {reset
                  ? "Nếu bạn không gửi yêu cầu này, hãy bỏ qua email. Mật khẩu hiện tại của bạn vẫn được giữ nguyên."
                  : "Bạn có thể đăng nhập lại bằng mật khẩu mới để tiếp tục mua sắm và theo dõi đơn hàng."}
              </Text>
              <Hr
                style={{ border: "none", borderTop: "1px solid #ecece6", margin: "26px 0 20px" }}
              />
              <Text style={{ margin: 0, fontSize: "12px", lineHeight: "1.8", color: "#72726b" }}>
                Nút không hoạt động?{" "}
                <Link href={actionUrl} style={{ color: "#a43b00", textDecoration: "underline" }}>
                  {reset ? "Mở liên kết đặt lại mật khẩu" : "Mở trang đăng nhập"}
                </Link>
                .
                <br />
                Cần trợ giúp?{" "}
                <Link
                  href={`mailto:${supportEmail}`}
                  style={{ color: "#52524d", textDecoration: "underline" }}
                >
                  Liên hệ TechNest
                </Link>
                .
              </Text>
            </Section>
            <Text
              style={{
                margin: "22px 12px 0",
                textAlign: "center",
                fontSize: "11px",
                lineHeight: "1.8",
                color: "#787871",
              }}
            >
              Email được gửi tự động từ TechNest.
              <br />
              Bảo vệ tài khoản của bạn. Không chia sẻ mật khẩu hoặc liên kết khôi phục.
            </Text>
          </Container>
        </Section>
      </Body>
    </Html>
  );
}
