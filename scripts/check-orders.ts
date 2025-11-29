// Test script to check if there are any fulfilled orders
import { execSync } from 'child_process'

const cmd = `npx prisma db execute --stdin <<'QUERY'
SELECT 
  ol."productId",
  ol.status,
  oh.status as "orderStatus",
  COUNT(*) as count
FROM "OrderLine" ol
JOIN "OrderHeader" oh ON ol."orderHeaderId" = oh.id
WHERE ol."departmentCode" = 'restaurant:main'
GROUP BY ol."productId", ol.status, oh.status
ORDER BY count DESC;
QUERY
`

try {
  const result = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' })
  console.log(result)
} catch (e: any) {
  console.error('Error:', e.message)
}
