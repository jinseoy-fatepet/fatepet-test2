import Stripe from "stripe";
import { NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-02-24-preview",
});

export async function POST(req: Request) {
  try {
    const origin = req.headers.get("origin");

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
            unit_amount: 4900,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/full?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/result`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
