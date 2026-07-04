import { useMemo, type ReactNode } from "react";
import {
  formatI18nCurrency,
  formatI18nNumber,
} from "../../../i18n/formatters";
import type { Language } from "../../../i18n/types";
import { useI18n } from "../../../i18n/useI18n";
import type {
  AdminOrder,
  AdminProduct,
  AdminRange,
  AdminStats,
} from "../admin.types";

interface AdminDashboardChartsProps {
  isLoading: boolean;
  products: AdminProduct[];
  range: AdminRange;
  stats: AdminStats | null;
}

interface TrendPoint {
  dateKey: string;
  label: string;
  orders: number;
  revenue: number;
}

interface ChartCardProps {
  children: ReactNode;
  className?: string;
  description: string;
  title: string;
}

interface PaymentSegment {
  color: string;
  key: "cancelled" | "expired" | "failed" | "paid" | "pending";
  value: number;
}

interface HorizontalBarProps {
  colorClassName: string;
  label: string;
  max: number;
  value: number;
  valueLabel: string;
}

const paymentColors = {
  paid: "#00e5ff",
  pending: "#9cf0ff",
  failed: "#ff8a80",
  cancelled: "#849396",
  expired: "#f3bf26",
} as const;

function ChartCard({
  children,
  className = "",
  description,
  title,
}: ChartCardProps) {
  return (
    <article
      className={`min-w-0 overflow-hidden rounded-lg border border-[#3b494c] bg-[#1c1b1b] ${className}`}
    >
      <div className="border-b border-[#3b494c]/70 px-5 py-4 sm:px-6">
        <h3 className="font-display text-xl font-semibold text-white">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-[#bac9cc]">{description}</p>
      </div>
      {children}
    </article>
  );
}

function ChartSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`animate-pulse p-5 sm:p-6 ${compact ? "space-y-4" : ""}`}>
      {compact ? (
        <>
          <div className="mx-auto h-36 w-36 rounded-full border-[18px] border-white/[0.07]" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="h-10 rounded-sm bg-white/[0.07]" key={index} />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="h-14 rounded-sm bg-white/[0.07]" />
            <div className="h-14 rounded-sm bg-white/[0.07]" />
          </div>
          <div className="h-56 rounded-sm bg-white/[0.07]" />
        </>
      )}
    </div>
  );
}

function ChartEmptyState() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-56 items-center justify-center p-6 text-center">
      <div>
        <p className="text-sm font-bold text-white">
          {t("admin.charts.empty.title")}
        </p>
        <p className="mt-2 max-w-sm text-sm leading-6 text-[#849396]">
          {t("admin.charts.empty.description")}
        </p>
      </div>
    </div>
  );
}

function formatChartDate(dateKey: string, language: Language) {
  return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T00:00:00.000Z`));
}

function getRangeStart(range: AdminRange) {
  if (range === "all") {
    return null;
  }

  const start = new Date();
  start.setDate(start.getDate() - (range === "7d" ? 7 : 30));
  return start;
}

function buildTrendPoints(
  orders: AdminOrder[],
  range: AdminRange,
  language: Language,
): TrendPoint[] {
  const rangeStart = getRangeStart(range);
  const pointsByDate = new Map<
    string,
    {
      orders: number;
      revenue: number;
    }
  >();

  orders.forEach((order) => {
    const createdAt = new Date(order.createdAt);

    if (
      Number.isNaN(createdAt.getTime()) ||
      (rangeStart && createdAt < rangeStart)
    ) {
      return;
    }

    const dateKey = createdAt.toISOString().slice(0, 10);
    const current = pointsByDate.get(dateKey) ?? {
      orders: 0,
      revenue: 0,
    };

    current.orders += 1;

    if (order.status === "paid") {
      current.revenue += order.totalAmount;
    }

    pointsByDate.set(dateKey, current);
  });

  return Array.from(pointsByDate.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dateKey, point]) => ({
      dateKey,
      label: formatChartDate(dateKey, language),
      ...point,
    }));
}

function RevenueOrdersTrendChart({
  isLoading,
  range,
  stats,
}: Pick<AdminDashboardChartsProps, "isLoading" | "range" | "stats">) {
  const { language, t } = useI18n();
  const points = useMemo(
    () => buildTrendPoints(stats?.recentOrders ?? [], range, language),
    [language, range, stats?.recentOrders],
  );

  if (isLoading) {
    return <ChartSkeleton />;
  }

  if (points.length === 0) {
    return <ChartEmptyState />;
  }

  const width = 760;
  const height = 270;
  const padding = {
    bottom: 44,
    left: 28,
    right: 20,
    top: 20,
  };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const slotWidth = plotWidth / points.length;
  const barWidth = Math.min(42, slotWidth * 0.42);
  const maxRevenue = Math.max(...points.map((point) => point.revenue), 1);
  const barPoints = points.map((point, index) => {
    const x = padding.left + slotWidth * index + slotWidth / 2;

    return { ...point, x };
  });
  const totalRevenue = points.reduce(
    (total, point) => total + point.revenue,
    0,
  );
  const totalOrders = points.reduce((total, point) => total + point.orders, 0);
  const hasPaidRevenue = totalRevenue > 0;

  return (
    <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
      <div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-md border border-[#00e5ff]/18 bg-[#00e5ff]/[0.06] p-3">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[#849396]">
              {t("admin.charts.trend.sampleRevenue")}
            </p>
            <p className="mt-2 font-display text-xl font-semibold text-white">
              {formatI18nCurrency(totalRevenue, language)}
            </p>
          </div>
          <div className="rounded-md border border-white/[0.08] bg-white/[0.025] p-3">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[#849396]">
              {t("admin.charts.trend.sampleOrders")}
            </p>
            <p className="mt-2 font-display text-xl font-semibold text-white">
              {formatI18nNumber(totalOrders, language)}
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs leading-5 text-[#849396]">
          {t("admin.charts.trend.disclaimer", {
            count: stats?.recentOrders.length ?? 0,
          })}
        </p>
      </div>

      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-[#bac9cc]">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#00e5ff]" />
            {t("admin.charts.legend.paidRevenue")}
          </span>
        </div>

        {hasPaidRevenue ? (
          <div className="mx-auto w-full max-w-[960px]">
            <svg
              aria-label={t("admin.charts.trend.aria")}
              className="h-auto w-full"
              role="img"
              viewBox={`0 0 ${width} ${height}`}
            >
              <defs>
                <linearGradient
                  id="admin-trend-bar"
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#00e5ff" />
                  <stop offset="100%" stopColor="#006875" />
                </linearGradient>
              </defs>

              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = padding.top + plotHeight * ratio;

                return (
                  <line
                    key={ratio}
                    stroke="rgba(132, 147, 150, 0.18)"
                    strokeDasharray="4 8"
                    x1={padding.left}
                    x2={width - padding.right}
                    y1={y}
                    y2={y}
                  />
                );
              })}

              {barPoints.map((point) => {
                const barHeight = (point.revenue / maxRevenue) * plotHeight;

                return (
                  <g key={point.dateKey}>
                    <rect
                      fill="url(#admin-trend-bar)"
                      height={barHeight}
                      opacity={point.revenue > 0 ? 0.9 : 0}
                      rx="4"
                      width={barWidth}
                      x={point.x - barWidth / 2}
                      y={padding.top + plotHeight - barHeight}
                    >
                      <title>
                        {`${point.label}: ${formatI18nCurrency(
                          point.revenue,
                          language,
                        )}`}
                      </title>
                    </rect>
                    <text
                      fill="#849396"
                      fontSize="10"
                      textAnchor="middle"
                      x={point.x}
                      y={height - 14}
                    >
                      {point.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <ChartEmptyState />
        )}
      </div>
    </div>
  );
}

function PaymentStatusDistributionChart({
  isLoading,
  stats,
}: Pick<AdminDashboardChartsProps, "isLoading" | "stats">) {
  const { language, t } = useI18n();
  const segments = useMemo<PaymentSegment[]>(() => {
    const payments = stats?.payments;

    if (!payments) {
      return [];
    }

    const knownTerminal =
      payments.succeeded +
      payments.failed +
      payments.cancelled +
      payments.expired;
    const pending = Math.max(0, payments.totalTransactions - knownTerminal);

    return [
      { key: "paid", value: payments.succeeded, color: paymentColors.paid },
      { key: "pending", value: pending, color: paymentColors.pending },
      { key: "failed", value: payments.failed, color: paymentColors.failed },
      {
        key: "cancelled",
        value: payments.cancelled,
        color: paymentColors.cancelled,
      },
      {
        key: "expired",
        value: payments.expired,
        color: paymentColors.expired,
      },
    ];
  }, [stats?.payments]);

  if (isLoading) {
    return <ChartSkeleton compact />;
  }

  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  if (total === 0) {
    return <ChartEmptyState />;
  }

  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  let consumedRatio = 0;

  return (
    <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
      <div className="relative mx-auto h-44 w-44">
        <svg
          aria-label={t("admin.charts.payment.aria")}
          className="h-full w-full"
          role="img"
          viewBox="0 0 120 120"
        >
          <circle
            cx="60"
            cy="60"
            fill="none"
            r={radius}
            stroke="#353534"
            strokeWidth="13"
          />
          {segments.map((segment) => {
            const ratio = segment.value / total;
            const dashLength = ratio * circumference;
            const dashOffset = -consumedRatio * circumference;
            consumedRatio += ratio;

            return (
              <circle
                cx="60"
                cy="60"
                fill="none"
                key={segment.key}
                r={radius}
                stroke={segment.color}
                strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="butt"
                strokeWidth="13"
                transform="rotate(-90 60 60)"
              >
                <title>
                  {`${t(`admin.charts.payment.${segment.key}`)}: ${formatI18nNumber(
                    segment.value,
                    language,
                  )}`}
                </title>
              </circle>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-semibold text-white">
            {formatI18nNumber(total, language)}
          </span>
          <span className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-[#849396]">
            {t("admin.charts.payment.total")}
          </span>
        </div>
      </div>

      <div className="grid gap-2.5">
        {segments.map((segment) => (
          <div
            className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-white/[0.07] bg-white/[0.025] px-3 py-2.5"
            key={segment.key}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: segment.color }}
              />
              <span className="truncate text-sm font-semibold text-[#bac9cc]">
                {t(`admin.charts.payment.${segment.key}`)}
              </span>
            </span>
            <span className="shrink-0 text-sm font-bold text-white">
              {formatI18nNumber(segment.value, language)}
              <span className="ml-2 text-xs font-semibold text-[#849396]">
                {Math.round((segment.value / total) * 100)}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HorizontalBar({
  colorClassName,
  label,
  max,
  value,
  valueLabel,
}: HorizontalBarProps) {
  const width = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4 text-sm">
        <span className="font-semibold text-[#bac9cc]">{label}</span>
        <span className="font-bold text-white">{valueLabel}</span>
      </div>
      <div
        aria-label={`${label}: ${valueLabel}`}
        aria-valuemax={max}
        aria-valuemin={0}
        aria-valuenow={value}
        className="h-2.5 overflow-hidden rounded-sm bg-[#353534]"
        role="meter"
      >
        <div
          className={`h-full rounded-sm transition-[width] duration-500 ${colorClassName}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function ProductCreditMixChart({
  isLoading,
  products,
  stats,
}: Pick<AdminDashboardChartsProps, "isLoading" | "products" | "stats">) {
  const { language, t } = useI18n();
  const activeProducts = products.filter((product) => product.isActive);
  const subscriptionProducts = activeProducts.filter(
    (product) => product.kind === "subscription_plan",
  ).length;
  const creditProducts = activeProducts.filter(
    (product) => product.kind === "credit_pack",
  ).length;
  const productMax = Math.max(subscriptionProducts, creditProducts, 1);
  const purchasedCredits = stats?.credits.purchasedInRange ?? 0;
  const consumedCredits = stats?.credits.consumedInRange ?? 0;
  const creditMax = Math.max(purchasedCredits, consumedCredits, 1);
  const hasData =
    activeProducts.length > 0 || purchasedCredits > 0 || consumedCredits > 0;

  if (isLoading) {
    return <ChartSkeleton />;
  }

  if (!hasData) {
    return <ChartEmptyState />;
  }

  return (
    <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-2">
      <div>
        <div className="mb-5 flex items-center justify-between gap-4">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#849396]">
            {t("admin.charts.mix.catalog")}
          </p>
          <span className="rounded-sm border border-[#00e5ff]/20 bg-[#00e5ff]/[0.06] px-2 py-1 text-xs font-bold text-[#9cf0ff]">
            {t("admin.charts.mix.activeProducts", {
              count: formatI18nNumber(activeProducts.length, language),
            })}
          </span>
        </div>
        <div className="space-y-5">
          <HorizontalBar
            colorClassName="bg-[#00e5ff]"
            label={t("admin.charts.mix.subscriptionPlans")}
            max={productMax}
            value={subscriptionProducts}
            valueLabel={formatI18nNumber(subscriptionProducts, language)}
          />
          <HorizontalBar
            colorClassName="bg-[#9cf0ff]"
            label={t("admin.charts.mix.creditPacks")}
            max={productMax}
            value={creditProducts}
            valueLabel={formatI18nNumber(creditProducts, language)}
          />
        </div>
      </div>

      <div className="border-t border-[#3b494c]/70 pt-6 md:border-l md:border-t-0 md:pl-6 md:pt-0">
        <p className="mb-5 text-xs font-bold uppercase tracking-[0.08em] text-[#849396]">
          {t("admin.charts.mix.creditActivity")}
        </p>
        <div className="space-y-5">
          <HorizontalBar
            colorClassName="bg-[#00e5ff]"
            label={t("admin.charts.mix.purchased")}
            max={creditMax}
            value={purchasedCredits}
            valueLabel={formatI18nNumber(purchasedCredits, language)}
          />
          <HorizontalBar
            colorClassName="bg-[#f3bf26]"
            label={t("admin.charts.mix.consumed")}
            max={creditMax}
            value={consumedCredits}
            valueLabel={formatI18nNumber(consumedCredits, language)}
          />
        </div>
      </div>
    </div>
  );
}

export function AdminDashboardCharts({
  isLoading,
  products,
  range,
  stats,
}: AdminDashboardChartsProps) {
  const { t } = useI18n();

  return (
    <section aria-labelledby="admin-analytics-title">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#00e5ff]">
          {t("admin.charts.eyebrow")}
        </p>
        <h2
          className="mt-2 font-display text-2xl font-semibold text-white"
          id="admin-analytics-title"
        >
          {t("admin.charts.title")}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#bac9cc]">
          {t("admin.charts.description")}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          className="lg:col-span-2"
          description={t("admin.charts.trend.description")}
          title={t("admin.charts.trend.title")}
        >
          <RevenueOrdersTrendChart
            isLoading={isLoading}
            range={range}
            stats={stats}
          />
        </ChartCard>

        <ChartCard
          description={t("admin.charts.payment.description")}
          title={t("admin.charts.payment.title")}
        >
          <PaymentStatusDistributionChart
            isLoading={isLoading}
            stats={stats}
          />
        </ChartCard>

        <ChartCard
          description={t("admin.charts.mix.description")}
          title={t("admin.charts.mix.title")}
        >
          <ProductCreditMixChart
            isLoading={isLoading}
            products={products}
            stats={stats}
          />
        </ChartCard>
      </div>
    </section>
  );
}
