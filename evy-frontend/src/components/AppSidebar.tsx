import { LayoutDashboard, Ticket, Terminal, BookOpen } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Tickets", url: "/tickets", icon: Ticket },
  { title: "AI Terminal", url: "/usage", icon: Terminal },
  { title: "Knowledge Base", url: "/knowledge", icon: BookOpen },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" className="border-r border-glass-border bg-sidebar/80 backdrop-blur-xl">
      <div className="flex items-center gap-2 px-4 py-5 border-b border-glass-border">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-purple">
          <span className="text-sm font-bold text-primary-foreground">E</span>
        </div>
        {!collapsed && (
          <span className="text-lg font-bold text-gradient-purple">Evy</span>
        )}
      </div>
      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground transition-all hover:text-foreground hover:bg-secondary/60"
                      activeClassName="text-primary bg-primary/10 glow-purple"
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
