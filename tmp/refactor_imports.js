/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

function replaceInFile(filepath, regex, replacement) {
  try {
    const fullPath = path.resolve('c:/Users/admin/Desktop/Antigravity_workspace/softwareeng', filepath);
    if (!fs.existsSync(fullPath)) return;
    let content = fs.readFileSync(fullPath, 'utf8');
    content = content.replace(regex, replacement);
    fs.writeFileSync(fullPath, content, 'utf8');
  } catch (e) {
    console.error(e);
  }
}

const apiRoutes = [
  'src/app/api/subjects/route.ts',
  'src/app/api/plans/route.ts',
  'src/app/api/subjects/[id]/topics/route.ts',
  'src/app/api/logs/route.ts',
  'src/app/api/feedback/route.ts',
  'src/app/api/insights/route.ts'
];

apiRoutes.forEach(f => {
  replaceInFile(f, /import \{ getServerSession \} from 'next-auth'/g, "import { getServerSession } from '@/lib/supabase/server'");
  replaceInFile(f, /import \{ authOptions \} from '@\/app\/api\/auth\/\[\.\.\.nextauth\]\/route'/g, "");
  replaceInFile(f, /getServerSession\(authOptions\)/g, "getServerSession()");
});

const clientComponents = [
  'src/components/planner/PlannerPage.tsx',
  'src/components/logger/LoggerPage.tsx',
  'src/components/layout/Sidebar.tsx',
  'src/components/insights/InsightsPage.tsx',
  'src/app/page.tsx',
  'src/app/dashboard/page.tsx',
  'src/app/login/page.tsx'
];

clientComponents.forEach(f => {
  replaceInFile(f, /import \{ useSession(?:, signOut)? \} from 'next-auth\/react'/g, "import { useSession, signOut } from '@/components/Providers'");
});

const services = [
  'src/services/auth.service.ts',
  'src/services/topics.service.ts',
  'src/services/subjects.service.ts',
  'src/services/plans.service.ts',
  'src/services/logs.service.ts',
  'src/services/insights.service.ts',
  'src/services/feedback.service.ts'
];

services.forEach(f => {
  replaceInFile(f, /import \{ supabase \} from '@\/lib\/supabase'/g, "import { createClient } from '@/lib/supabase/server'");
  replaceInFile(f, /await supabase/g, "await (await createClient())");
});
