/**
 * Cleaning staff page for viewing and managing assigned cleaning tasks
 */

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth-context';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  Play,
  Loader,
  X,
} from 'lucide-react';

interface CleaningTask {
  id: string;
  taskNumber: string;
  unitId: string;
  unit: {
    roomNumber: string;
    roomType: {
      name: string;
    };
  };
  status: string;
  priority: string;
  taskType: string;
  assignedToId: string;
  startedAt?: string;
  completedAt?: string;
  notes?: string;
  createdAt: string;
}

interface UpdateTaskRequest {
  status: string;
  notes?: string;
}

const statusColors = {
  PENDING: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  INSPECTED: 'bg-purple-100 text-purple-800',
  REJECTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-200 text-gray-500',
};

const priorityColors = {
  LOW: 'text-gray-600',
  NORMAL: 'text-blue-600',
  HIGH: 'text-orange-600',
  URGENT: 'text-red-600',
};

export default function CleaningTasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<CleaningTask | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState(false);
  const [taskNotes, setTaskNotes] = useState('');

  // Fetch tasks
  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (user?.id) {
        params.append('assignedToId', user.id);
      }

      const response = await fetch(`/api/cleaning-tasks?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTask = async (taskId: string) => {
    try {
      setActionLoading(true);
      const response = await fetch(`/api/cleaning-tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'IN_PROGRESS',
          startedAt: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        await fetchTasks();
        setSelectedTask(null);
      } else {
        alert('Error starting task');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error starting task');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      setActionLoading(true);
      const response = await fetch(`/api/cleaning-tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'COMPLETED',
          completedAt: new Date().toISOString(),
          notes: taskNotes,
        }),
      });

      if (response.ok) {
        await fetchTasks();
        setSelectedTask(null);
        setTaskNotes('');
      } else {
        alert('Error completing task');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error completing task');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredTasks = statusFilter === 'all'
    ? tasks
    : tasks.filter((t) => t.status === statusFilter);

  const pendingCount = tasks.filter((t) => t.status === 'PENDING').length;
  const inProgressCount = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;

  if (loading && tasks.length === 0) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">My Cleaning Tasks</h1>
        <p className="text-gray-600">
          Manage your assigned room cleaning tasks
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-3xl font-bold text-yellow-600">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">In Progress</p>
              <p className="text-3xl font-bold text-blue-600">{inProgressCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-3xl font-bold text-green-600">{completedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tasks</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={fetchTasks}
          disabled={loading}
        >
          {loading && <Loader className="w-4 h-4 mr-2 animate-spin" />}
          Refresh
        </Button>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="pt-8">
              <p className="text-center text-gray-600">
                {statusFilter === 'all'
                  ? 'No tasks assigned yet'
                  : `No ${statusFilter.toLowerCase()} tasks`}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredTasks.map((task) => (
            <Card
              key={task.id}
              className={`cursor-pointer transition-all ${
                expandedTaskId === task.id ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() =>
                setExpandedTaskId(expandedTaskId === task.id ? null : task.id)
              }
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-lg">
                        Room {task.unit.roomNumber}
                      </h3>
                      <Badge className={statusColors[task.status as keyof typeof statusColors]}>
                        {task.status}
                      </Badge>
                      <span className={`text-sm font-semibold ${priorityColors[task.priority as keyof typeof priorityColors]}`}>
                        {task.priority}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {task.unit.roomType.name} • {task.taskType}
                    </p>
                    {task.notes && !expandedTaskId && (
                      <p className="text-sm text-gray-500 line-clamp-1">
                        {task.notes}
                      </p>
                    )}
                  </div>
                  {task.status === 'PENDING' && (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartTask(task.id);
                      }}
                      disabled={actionLoading}
                      className="gap-1"
                    >
                      <Play className="w-3 h-3" />
                      Start
                    </Button>
                  )}
                  {task.status === 'IN_PROGRESS' && (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTask(task);
                        setExpandedTaskId(task.id);
                      }}
                      variant="default"
                      className="gap-1"
                    >
                      <CheckCircle className="w-3 h-3" />
                      Complete
                    </Button>
                  )}
                </div>

                {/* Expanded Details */}
                {expandedTaskId === task.id && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    {task.startedAt && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4" />
                        <span>
                          Started: {new Date(task.startedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                    {task.completedAt && (
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span>
                          Completed: {new Date(task.completedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                    {task.notes && (
                      <div>
                        <p className="text-sm font-semibold mb-1">Notes:</p>
                        <p className="text-sm bg-gray-50 p-2 rounded">
                          {task.notes}
                        </p>
                      </div>
                    )}

                    {/* Complete Task Form */}
                    {task.status === 'IN_PROGRESS' && selectedTask?.id === task.id && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-semibold">
                            Completion Notes (optional)
                          </label>
                          <Textarea
                            value={taskNotes}
                            onChange={(e) => setTaskNotes(e.target.value)}
                            placeholder="Any issues or notes about this room..."
                            className="mt-1"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCompleteTask(task.id);
                            }}
                            disabled={actionLoading}
                            className="gap-1"
                          >
                            {actionLoading && (
                              <Loader className="w-4 h-4 animate-spin" />
                            )}
                            Mark Complete
                          </Button>
                          <Button
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTask(null);
                              setTaskNotes('');
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
