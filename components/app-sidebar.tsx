'use client';

import type { User } from 'next-auth';
import { useRouter } from 'next/navigation';

import { PlusIcon } from '@/components/icons';
import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { ProjectList } from '@/components/project-list';
import { PortfolioStockList } from '@/components/portfolio-stock-list';
import { useViewMode } from '@/hooks/use-view-mode';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { useQueryLoading } from '@/hooks/use-query-loading';

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const { setQueryLoading } = useQueryLoading();
  const { mode } = useViewMode();

  return (
    <Sidebar collapsible="icon" className="group-data-[side=left]:border-r-0 bg-sidebar">
      <SidebarHeader className="group-data-[collapsible=icon]:hidden">
        <SidebarMenu>
          <div className="flex flex-row justify-between items-center px-2 py-2">
            <span className="font-bold text-sm text-sidebar-foreground truncate">
              {mode === 'chat'
                ? 'Chat History'
                : mode === 'canvas'
                  ? 'Project Workspace'
                  : 'Portfolio Company'}
            </span>
            {mode === 'chat' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    type="button"
                    className="p-2 h-fit hover:bg-sidebar-accent"
                    onClick={() => {
                      setOpenMobile(false);
                      setQueryLoading(false, []);
                      router.push('/');
                      router.refresh();
                    }}
                  >
                    <PlusIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent align="end">New Chat</TooltipContent>
              </Tooltip>
            )}
          </div>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="group-data-[collapsible=icon]:hidden">
        {mode === 'chat' ? (
          <SidebarHistory user={user} />
        ) : mode === 'canvas' ? (
          <ProjectList />
        ) : (
          <PortfolioStockList />
        )}
      </SidebarContent>
      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        {user && <SidebarUserNav user={user} />}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
