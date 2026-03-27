export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ResetPassword: undefined;
  Dashboard: undefined;
  Kanban: { projectId: string; projectName: string };
  TaskDetail: { taskId: string; taskTitle: string; projectId: string };
};
