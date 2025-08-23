'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Bot, 
  Play, 
  Square, 
  Settings, 
  Zap,
  Eye,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react'

interface CUAInterfaceProps {}

export function CUAInterface({}: CUAInterfaceProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [currentTask, setCurrentTask] = useState('')
  const [taskHistory, setTaskHistory] = useState<Array<{
    id: string
    task: string
    status: 'running' | 'completed' | 'failed'
    startTime: string
    endTime?: string
    logs: string[]
  }>>([])

  const [apiKey, setApiKey] = useState('')

  const handleStartTask = async (task: string) => {
    if (!apiKey.trim()) {
      alert('Please configure your OpenAI API key first')
      return
    }

    setIsRunning(true)
    setCurrentTask(task)
    
    const newTask = {
      id: Math.random().toString(36).substring(2, 9),
      task,
      status: 'running' as const,
      startTime: new Date().toISOString(),
      logs: [`Starting task: ${task}`, 'Initializing Computer Use Agent...']
    }
    
    setTaskHistory(prev => [newTask, ...prev])

    // Simulate task execution
    setTimeout(() => {
      setIsRunning(false)
      setCurrentTask('')
      setTaskHistory(prev => prev.map(t => 
        t.id === newTask.id 
          ? {
              ...t,
              status: 'completed' as const,
              endTime: new Date().toISOString(),
              logs: [...t.logs, 'Task completed successfully', 'Agent finished execution'] 
            }
          : t
      ))
    }, 5000)
  }

  const handleStopTask = () => {
    setIsRunning(false)
    setCurrentTask('')
    if (taskHistory.length > 0) {
      setTaskHistory(prev => prev.map((t, index) => 
        index === 0 && t.status === 'running'
          ? {
              ...t,
              status: 'failed' as const,
              endTime: new Date().toISOString(),
              logs: [...t.logs, 'Task stopped by user']
            }
          : t
      ))
    }
  }

  const quickTasks = [
    "Take a screenshot of the current desktop",
    "Open a web browser and navigate to google.com",
    "Create a new text file and write 'Hello World'",
    "Check system information and memory usage",
    "List all running processes",
  ]

  return (
    <div className="h-full p-6">
      <div className="max-w-6xl mx-auto h-full">
        <Tabs defaultValue="execute" className="h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Bot className="h-6 w-6" />
              <h2 className="text-2xl font-bold">Computer Use Agent</h2>
              <Badge variant="outline" className="text-xs">
                AI-Powered Automation
              </Badge>
            </div>

            <TabsList>
              <TabsTrigger value="execute">Execute</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="execute" className="flex-1 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Task Input */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MessageSquare className="h-5 w-5" />
                    <span>Task Command</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Describe what you want the AI agent to do:
                    </label>
                    <textarea
                      className="w-full h-32 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="e.g., Open the calculator app and compute 125 * 47"
                      value={currentTask}
                      onChange={(e) => setCurrentTask(e.target.value)}
                      disabled={isRunning}
                    />
                  </div>

                  <div className="flex space-x-2">
                    {!isRunning ? (
                      <Button 
                        onClick={() => handleStartTask(currentTask)}
                        disabled={!currentTask.trim() || !apiKey.trim()}
                        className="flex-1"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Execute Task
                      </Button>
                    ) : (
                      <Button 
                        variant="destructive"
                        onClick={handleStopTask}
                        className="flex-1"
                      >
                        <Square className="h-4 w-4 mr-2" />
                        Stop Task
                      </Button>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Quick Tasks:</label>
                    <div className="space-y-2">
                      {quickTasks.map((task, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          className="w-full justify-start text-left h-auto p-3"
                          onClick={() => setCurrentTask(task)}
                          disabled={isRunning}
                        >
                          <Zap className="h-3 w-3 mr-2 shrink-0" />
                          <span className="text-sm">{task}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Live Execution View */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Eye className="h-5 w-5" />
                    <span>Execution Monitor</span>
                    {isRunning && (
                      <Badge variant="default" className="text-xs animate-pulse">
                        Running
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isRunning ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                          <span className="font-medium text-sm">Active Task</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{currentTask}</p>
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium">Live Logs:</div>
                        <div className="bg-black text-green-400 p-3 rounded font-mono text-xs h-48 overflow-y-auto">
                          {taskHistory[0]?.logs.map((log, index) => (
                            <div key={index} className="mb-1">
                              [{new Date().toLocaleTimeString()}] {log}
                            </div>
                          ))}
                          {isRunning && (
                            <div className="flex items-center space-x-1">
                              <span>Processing...</span>
                              <div className="animate-pulse">▍</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-center">
                      <div className="space-y-4">
                        <Bot className="h-12 w-12 text-muted-foreground mx-auto" />
                        <div>
                          <h3 className="font-medium">Ready to Execute</h3>
                          <p className="text-sm text-muted-foreground">
                            Enter a task description and click Execute to start
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history" className="flex-1">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Task History</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {taskHistory.length === 0 ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center space-y-2">
                      <Clock className="h-8 w-8 text-muted-foreground mx-auto" />
                      <p className="text-muted-foreground">No tasks executed yet</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {taskHistory.map((task) => (
                      <div key={task.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{task.task}</p>
                            <p className="text-xs text-muted-foreground">
                              Started: {new Date(task.startTime).toLocaleString()}
                              {task.endTime && ` • Ended: ${new Date(task.endTime).toLocaleString()}`}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            {task.status === 'running' && (
                              <Badge variant="default" className="text-xs">
                                <div className="animate-spin h-2 w-2 border border-white border-t-transparent rounded-full mr-1" />
                                Running
                              </Badge>
                            )}
                            {task.status === 'completed' && (
                              <Badge variant="default" className="text-xs bg-green-500">
                                <CheckCircle className="h-2 w-2 mr-1" />
                                Completed
                              </Badge>
                            )}
                            {task.status === 'failed' && (
                              <Badge variant="destructive" className="text-xs">
                                <XCircle className="h-2 w-2 mr-1" />
                                Failed
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                            View Logs ({task.logs.length} entries)
                          </summary>
                          <div className="mt-2 bg-muted p-2 rounded text-xs font-mono">
                            {task.logs.map((log, index) => (
                              <div key={index}>{log}</div>
                            ))}
                          </div>
                        </details>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="flex-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-5 w-5" />
                  <span>CUA Configuration</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    OpenAI API Key
                  </label>
                  <input
                    type="password"
                    className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Required for computer use functionality. Your key is stored locally.
                  </p>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg">
                  <h3 className="font-medium mb-2">About Computer Use Agent</h3>
                  <p className="text-sm text-muted-foreground">
                    The Computer Use Agent (CUA) allows AI to interact with computer interfaces 
                    just like a human would. It can take screenshots, click buttons, type text, 
                    and perform complex multi-step tasks across applications.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}