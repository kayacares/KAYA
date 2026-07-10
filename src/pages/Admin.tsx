import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import {
  ArrowLeft,
  Box,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Gift,
  History,
  LayoutDashboard,
  Layers,
  LogOut,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Store,
  Truck,
  UserCircle,
  UserCog,
  Users2,
} from "lucide-react";
import CarePackagesTab from "@/components/admin/CarePackagesTab";
import DashboardTab from "@/components/admin/DashboardTab";
import OrdersTab from "@/components/admin/OrdersTab";
import ProductsTab from "@/components/admin/ProductsTab";
import ShopsTab from "@/components/admin/ShopsTab";
import VendorsTab from "@/components/admin/VendorsTab";
import DeliveryAreasTab from "@/components/admin/DeliveryAreasTab";
import DeliveryScheduleTab from "@/components/admin/DeliveryScheduleTab";
import CustomersTab from "@/components/admin/CustomersTab";
import RecipientsTab from "@/components/admin/RecipientsTab";
import InvestigationsTab from "@/components/admin/InvestigationsTab";
import WaitlistTab from "@/components/admin/WaitlistTab";
import AuditLogTab from "@/components/admin/AuditLogTab";
import StaffTab from "@/components/admin/StaffTab";
import InstallAppButton from "@/components/features/InstallAppButton";
import {
  ROLE_LABEL,
  can,
  getRole,
  type Permission,
} from "@/lib/permissions";

type Tab =
  | "dashboard"
  | "orders"
  | "shops"
  | "products"
  | "care_packages"
  | "vendors"
  | "delivery_areas"
  | "delivery_schedule"
  | "customers"
  | "recipients"
  | "waitlist"
  | "investigations"
  | "audit"
  | "staff";

interface TabDef {
  id: Tab;
  label: string;
  Icon: any;
  permission: Permission;
}

const ALL_TABS: TabDef[] = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard, permission: "dashboard.view" },
  { id: "orders", label: "Orders", Icon: Layers, permission: "orders.view" },
  { id: "shops", label: "Shops", Icon: Store, permission: "shops.view" },
  { id: "products", label: "Products", Icon: Box, permission: "products.view" },
  { id: "care_packages", label: "Care Packages", Icon: Gift, permission: "care_packages.view" },
  { id: "vendors", label: "Vendors", Icon: Truck, permission: "vendors.view" },
  { id: "delivery_areas", label: "Delivery", Icon: MapPin, permission: "delivery_areas.view" },
  { id: "delivery_schedule", label: "Schedule", Icon: CalendarClock, permission: "settings.edit" },
  { id: "customers", label: "Customers", Icon: UserCircle, permission: "customers.view" },
  { id: "recipients", label: "Recipients", Icon: Users2, permission: "recipients.view" },
  { id: "waitlist", label: "Waitlist", Icon: ClipboardList, permission: "waitlist.view" },
  { id: "investigations", label: "Investigations", Icon: ShieldAlert, permission: "investigations.view" },
  { id: "audit", label: "Audit log", Icon: History, permission: "audit.view" },
  { id: "staff", label: "Staff", Icon: UserCog, permission: "staff.manage" },
];

export default function Admin() {
  const navigate = useNavigate();
  const { user, orders, logout } = useApp();
  const [params, setParams] = useSearchParams();

  const role = getRole(user);
  const isStaff = role !== "customer";
  const visibleTabs = useMemo(
    () => (user ? ALL_TABS.filter((t) => can(t.permission, user)) : []),
    [user]
  );
  const defaultTab: Tab = visibleTabs[0]?.id ?? "orders";
  const requested = params.get("tab") as Tab | null;
  const initial: Tab =
    requested && visibleTabs.some((t) => t.id === requested)
      ? requested
      : defaultTab;
  const [tab, setTab] = useState<Tab>(initial);

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === tab)) {
      setTab(defaultTab);
    }
  }, [visibleTabs, tab, defaultTab]);

  useEffect(() => {
    setParams({ tab }, { replace: true });
  }, [tab, setParams]);

  // Desktop tab strip can overflow on smaller laptops once we exceed
  // ~10 tabs. Track whether there's content hidden to the left/right of
  // the scroll container so we can surface ChevronLeft/Right buttons.
  const tabsRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = tabsRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(
      el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    );
  }, []);

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(updateScrollState);
      ro.observe(el);
    }
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
      ro?.disconnect();
    };
  }, [updateScrollState, visibleTabs.length, tab]);

  const scrollTabs = (delta: number) => {
    tabsRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  if (!user) return null;

  if (!isStaff) {
    return (
      <div className="min-h-screen bg-cream-50 grid place-items-center px-6">
        <div className="card-base p-8 text-center max-w-sm">
          <div className="grid place-items-center w-14 h-14 rounded-2xl bg-mustard-400 text-charcoal-900 mx-auto mb-3">
            <ShieldCheck size={22} />
          </div>
          <h2 className="display text-2xl font-semibold">Staff access only</h2>
          <p className="text-sm text-charcoal-400 mt-2">
            Sign in with a KAYA admin, ops or super-admin account to access the
            operations portal.
          </p>
          <button
            onClick={() => navigate("/")}
            className="btn-primary mt-5 w-full"
          >
            Back to app
          </button>
        </div>
      </div>
    );
  }

  const investigationCount = orders.filter(
    (o) => o.status === "Flagged for Investigation"
  ).length;

  return (
    <div className="min-h-screen bg-cream-50">
      <header className="sticky top-0 z-30 bg-charcoal-900 text-cream-50 shadow-hi">
        <div className="container-app px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="grid place-items-center w-10 h-10 rounded-2xl bg-cream-50/10 hover:bg-cream-50/20 transition"
            aria-label="Back to app"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-mustard-400 font-bold flex items-center gap-2">
              <span>KAYA Ops</span>
              <span className="text-cream-100/40">·</span>
              <span className="text-cream-100/70 truncate">
                {ROLE_LABEL[role]}
              </span>
            </div>
            <h1 className="display text-lg font-semibold truncate">
              {user.firstName ?? user.name}
            </h1>
          </div>
          <InstallAppButton label="Install" />
          <button
            onClick={() => {
              logout();
              navigate("/staff-login", { replace: true });
            }}
            className="grid place-items-center w-10 h-10 rounded-2xl bg-cream-50/10 hover:bg-clay-400 transition"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
        <div className="container-app px-2 pb-2">
          <div className="relative">
            <div
              aria-hidden={!canScrollLeft}
              className={`hidden sm:flex absolute left-0 top-0 bottom-0 z-20 items-center pl-1 pr-6 bg-gradient-to-r from-charcoal-900 via-charcoal-900 to-transparent transition-opacity ${
                canScrollLeft ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <button
                type="button"
                onClick={() => scrollTabs(-240)}
                aria-label="Scroll tabs left"
                title="More tabs"
                className="grid place-items-center w-8 h-8 rounded-full bg-mustard-400 hover:bg-mustard-500 text-charcoal-900 shadow-soft transition"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
            <div
              ref={tabsRef}
              className="flex gap-1 overflow-x-auto hide-scrollbar sm:px-10"
            >
              {visibleTabs.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`shrink-0 flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    tab === id
                      ? "bg-mustard-400 text-charcoal-900"
                      : "bg-cream-50/10 hover:bg-cream-50/20 text-cream-50"
                  }`}
                >
                  <Icon size={13} /> {label}
                  {id === "investigations" && investigationCount > 0 && (
                    <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-clay-400 text-cream-50 text-[10px] px-1 font-bold">
                      {investigationCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div
              aria-hidden={!canScrollRight}
              className={`hidden sm:flex absolute right-0 top-0 bottom-0 z-20 items-center pr-1 pl-6 bg-gradient-to-l from-charcoal-900 via-charcoal-900 to-transparent transition-opacity ${
                canScrollRight ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <button
                type="button"
                onClick={() => scrollTabs(240)}
                aria-label="Scroll tabs right"
                title="More tabs"
                className="grid place-items-center w-8 h-8 rounded-full bg-mustard-400 hover:bg-mustard-500 text-charcoal-900 shadow-soft transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container-app px-4 py-6">
        {tab === "dashboard" && <DashboardTab />}
        {tab === "orders" && <OrdersTab />}
        {tab === "shops" && <ShopsTab />}
        {tab === "products" && <ProductsTab />}
        {tab === "care_packages" && <CarePackagesTab />}
        {tab === "vendors" && <VendorsTab />}
        {tab === "delivery_areas" && <DeliveryAreasTab />}
        {tab === "delivery_schedule" && <DeliveryScheduleTab />}
        {tab === "customers" && <CustomersTab />}
        {tab === "recipients" && <RecipientsTab />}
        {tab === "waitlist" && <WaitlistTab />}
        {tab === "investigations" && <InvestigationsTab />}
        {tab === "audit" && <AuditLogTab />}
        {tab === "staff" && <StaffTab />}
      </main>
    </div>
  );
}
