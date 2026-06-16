import { db } from "@/lib/db.js";
import { HttpError } from "@/lib/httpError.js";
import { paginate, paginationArgs, type Paginated } from "@/lib/pagination.js";

export interface AdminUserView {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  credit: number;
  referredBy: string | null;
  createdAt: Date;
}

export interface ReferralStat {
  refCode: string;
  registrations: number;
  orders: number;
  totalAmount: number;
}

export async function listUsers(
  search?: string,
  page = 1,
  pageSize = 20
): Promise<Paginated<AdminUserView>> {
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search } },
        ],
      }
    : {};
  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...paginationArgs(page, pageSize),
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        referredBy: true,
        createdAt: true,
        credit: { select: { balance: true } },
      },
    }),
    db.user.count({ where }),
  ]);
  const items = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    status: u.status,
    credit: u.credit?.balance ?? 0,
    referredBy: u.referredBy,
    createdAt: u.createdAt,
  }));
  return paginate(items, total, page, pageSize);
}

export async function adjustCredit(
  userId: string,
  amount: number,
  mode: "add" | "set"
): Promise<{ balance: number }> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HttpError(404, "User tidak ditemukan");
  }
  const nextBalance =
    mode === "set"
      ? amount
      : Math.max(0, ((await getBalance(userId)) ?? 0) + amount);
  const credit = await db.credit.upsert({
    where: { userId },
    update: { balance: nextBalance },
    create: { userId, balance: nextBalance },
  });
  return { balance: credit.balance };
}

async function getBalance(userId: string): Promise<number> {
  const credit = await db.credit.findUnique({ where: { userId } });
  return credit?.balance ?? 0;
}

export async function updateUser(
  userId: string,
  data: { role?: string; status?: string; phone?: string | null }
): Promise<AdminUserView> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HttpError(404, "User tidak ditemukan");
  }
  if (data.phone !== undefined && data.phone !== null) {
    const conflict = await db.user.findFirst({
      where: { phone: data.phone, NOT: { id: userId } },
    });
    if (conflict) throw new HttpError(400, "Nomor HP sudah dipakai akun lain");
  }
  await db.user.update({
    where: { id: userId },
    data: {
      ...(data.role ? { role: data.role } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
    },
  });
  const [updated] = await listUsersById(userId);
  return updated;
}

export async function listReferrals(): Promise<ReferralStat[]> {
  const [byUser, byOrder] = await Promise.all([
    db.user.groupBy({
      by: ["referredBy"],
      where: { referredBy: { not: null } },
      _count: { id: true },
    }),
    db.order.groupBy({
      by: ["refCode"],
      where: { refCode: { not: null } },
      _count: { id: true },
      _sum: { amount: true },
    }),
  ]);

  const map = new Map<string, ReferralStat>();

  for (const row of byUser) {
    const code = row.referredBy!;
    map.set(code, {
      refCode: code,
      registrations: row._count.id,
      orders: 0,
      totalAmount: 0,
    });
  }
  for (const row of byOrder) {
    const code = row.refCode!;
    const existing = map.get(code) ?? {
      refCode: code,
      registrations: 0,
      orders: 0,
      totalAmount: 0,
    };
    existing.orders = row._count.id;
    existing.totalAmount = row._sum.amount ?? 0;
    map.set(code, existing);
  }

  return Array.from(map.values()).sort(
    (a, b) => b.registrations - a.registrations
  );
}

async function listUsersById(userId: string): Promise<AdminUserView[]> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      referredBy: true,
      createdAt: true,
      credit: { select: { balance: true } },
    },
  });
  if (!u) return [];
  return [
    {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      status: u.status,
      credit: u.credit?.balance ?? 0,
      referredBy: u.referredBy,
      createdAt: u.createdAt,
    },
  ];
}
