import { NextResponse } from "next/server";
import { db, t } from "@/db/client";
import { and, eq } from "drizzle-orm";
import { requireContext } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { household } = await requireContext();
  const rows = await db().select().from(t.attachments)
    .where(and(eq(t.attachments.householdId, household.id), eq(t.attachments.id, Number(params.id)))).limit(1);
  if (!rows.length) return new NextResponse("Not found", { status: 404 });
  const a = rows[0];
  return new NextResponse(Buffer.from(a.data, "base64"), {
    headers: { "Content-Type": a.mime, "Cache-Control": "private, max-age=3600" }
  });
}
