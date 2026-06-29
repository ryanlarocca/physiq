// Who are my users + how much are they using Physiq?
// Pure read from existing data (auth.users + weight/macro timestamps). No app changes.
// Usage: node scripts/users-report.mjs
import { sql } from './sb.mjs';

const rows = await sql(`
  select
    u.email,
    u.created_at::date::text                         as joined,
    coalesce(u.last_sign_in_at::date::text,'never')  as last_login,
    (u.email_confirmed_at is not null)               as confirmed,
    coalesce(w.n,0)::int                              as weights,
    coalesce(m.n,0)::int                              as macros,
    coalesce(greatest(w.last,m.last)::date::text,'—') as last_active,
    coalesce(extract(day from now()-greatest(w.last,m.last))::int, null) as days_since_active
  from auth.users u
  left join (select user_id, count(*) n, max(created_at) last from weight_entries group by user_id) w on w.user_id=u.id
  left join (select user_id, count(*) n, max(created_at) last from macro_entries  group by user_id) m on m.user_id=u.id
  order by greatest(w.last,m.last) desc nulls last, u.created_at desc
`);

const pad = (s,n) => String(s).padEnd(n).slice(0,n);
console.log('\n' + pad('email',30)+pad('joined',12)+pad('last login',12)+pad('conf',6)+pad('wts',6)+pad('macros',8)+pad('last active',13)+'idle');
console.log('-'.repeat(94));
for (const r of rows) {
  const idle = r.days_since_active==null ? '—' : (r.days_since_active===0 ? 'today' : `${r.days_since_active}d`);
  console.log(
    pad(r.email,30)+pad(r.joined,12)+pad(r.last_login,12)+pad(r.confirmed?'yes':'NO',6)+
    pad(r.weights,6)+pad(r.macros,8)+pad(r.last_active,13)+idle
  );
}

const total = rows.length;
const confirmed = rows.filter(r=>r.confirmed).length;
const active7  = rows.filter(r=>r.days_since_active!=null && r.days_since_active<=7).length;
const active30 = rows.filter(r=>r.days_since_active!=null && r.days_since_active<=30).length;
const everLogged = rows.filter(r=>r.weights>0||r.macros>0).length;
console.log('-'.repeat(94));
console.log(`${total} signups  •  ${confirmed} confirmed  •  ${everLogged} have logged data  •  ${active7} active last 7d  •  ${active30} active last 30d`);
