import Stripe from "stripe";
import { NextResponse } from "next/server";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      // @ts-ignore: keep a stable API version compatible with stripe@20
      apiVersion: "2025-11-17.clover",
    })
  : null;

export async function POST(req: Request) {
  try {
    if (!stripe) {
      throw new Error("Stripe API key is not configured.");
    }

    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.APP_URL ||
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "krw",
            product_data: {
              name: "반려견 전체 사주 분석 리포트",
              description: "우리 아이의 타고난 기운과 성격, 운명을 상세히 담은 리포트입니다.",
            },
            unit_amount: 900,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/full?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/result`,
    });

    if (!session.url) {
      throw new Error("Stripe checkout URL 생성 실패");
    }

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
