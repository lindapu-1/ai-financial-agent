'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Project } from '@/lib/db/schema';
import { cn, fetcher } from '@/lib/utils';
import { PlusIcon, TrashIcon } from './icons';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { useProject } from '@/hooks/use-project';
import { saveProject, deleteProjectById } from '@/app/(chat)/actions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';

export function ProjectList() {
  const { activeProject, setActiveProject } = useProject();
  const { data: projects, mutate, isLoading } = useSWR<Project[]>('/api/projects', fetcher, {
    fallbackData: [],
  });

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    setIsCreating(true);
    const id = crypto.randomUUID();
    try {
      await saveProject({ id, name: newProjectName });
      await mutate();
      setNewProjectName('');
      setIsCreateDialogOpen(false);
      toast.success('Project created successfully');
    } catch (error) {
      toast.error('Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteProjectById({ id });
      await mutate();
      if (activeProject?.id === id) {
        setActiveProject(null);
      }
      toast.success('Project deleted');
    } catch (error) {
      toast.error('Failed to delete project');
    }
  };

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Projects
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <PlusIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">New Project</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-col gap-1">
        {isLoading ? (
          <div className="px-2 py-4 text-xs text-muted-foreground text-center animate-pulse">
            Loading...
          </div>
        ) : projects?.length === 0 ? (
          <div className="px-2 py-4 text-xs text-muted-foreground text-center italic">
            No projects yet
          </div>
        ) : (
          projects?.map((p) => (
            <div
              key={p.id}
              className={cn(
                'group flex items-center justify-between w-full px-2 py-1.5 rounded-md text-sm transition-colors cursor-pointer',
                activeProject?.id === p.id
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'hover:bg-sidebar-accent/50 text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setActiveProject(p)}
            >
              <span className="truncate flex-1">{p.name}</span>
              <button
                onClick={(e) => handleDeleteProject(e, p.id)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all"
              >
                <TrashIcon size={12} />
              </button>
            </div>
          ))
        )}
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Enter a name for your new investment research project.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="col-span-3"
                placeholder="e.g. Hony Capital Tech Fund"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateProject();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateProject} disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
