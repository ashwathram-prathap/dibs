import{admin}from'./rollout-client';const [status,message]=process.argv.slice(2);await admin('/run',{status,message,at:new Date().toISOString()});console.log('Calendar run status recorded: '+status);
