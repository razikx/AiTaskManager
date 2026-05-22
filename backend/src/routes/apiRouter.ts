import { Router } from 'express';
import { getProjects, createProject, deleteProject } from '../controllers/projectController.js';
import { getTasks, createTask, updateTask, deleteTask } from '../controllers/taskController.js';
import { getSubtasksForTask, createSubtask, updateSubtask, deleteSubtask, bulkCreateSubtasks } from '../controllers/subtaskController.js';
import { parseTask, generateSubtasks } from '../controllers/aiController.js';

const apiRouter = Router();

//---------------------------------------------------------
// PROJECT ROUTES
//---------------------------------------------------------
const projectRouter = Router();
projectRouter.get('/', getProjects);
projectRouter.post('/', createProject);
projectRouter.delete('/:id', deleteProject);

//---------------------------------------------------------
// TASK & SUBTASK SUB-ROUTES
//---------------------------------------------------------
const taskRouter = Router();
taskRouter.get('/', getTasks);
taskRouter.post('/', createTask);
taskRouter.patch('/:id', updateTask);
taskRouter.delete('/:id', deleteTask);

// Subtask bindings inside task hierarchy
taskRouter.get('/:taskId/subtasks', getSubtasksForTask);
taskRouter.post('/:taskId/subtasks', createSubtask);
taskRouter.post('/:taskId/subtasks/bulk', bulkCreateSubtasks);
taskRouter.post('/:taskId/ai-subtasks', generateSubtasks);

const subtaskRouter = Router();
subtaskRouter.patch('/:id', updateSubtask);
subtaskRouter.delete('/:id', deleteSubtask);

//---------------------------------------------------------
// AI ENDPOINT ROUTES
//---------------------------------------------------------
const aiRouter = Router();
aiRouter.post('/parse-task', parseTask);

//---------------------------------------------------------
// MOUNT ROUTERS
//---------------------------------------------------------
apiRouter.use('/projects', projectRouter);
apiRouter.use('/tasks', taskRouter);
apiRouter.use('/subtasks', subtaskRouter);
apiRouter.use('/ai', aiRouter);

export default apiRouter;
