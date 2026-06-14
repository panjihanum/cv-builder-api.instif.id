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
  createdAt: Date;
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
  data: { role?: string; status?: string }
): Promise<AdminUserView> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HttpError(404, "User tidak ditemukan");
  }
  await db.user.update({
    where: { id: userId },
    data: {
      ...(data.role ? { role: data.role } : {}),
      ...(data.status ? { status: data.status } : {}),
    },
  });
  const [updated] = await listUsersById(userId);
  return updated;
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
      createdAt: u.createdAt,
    },
  ];
}
