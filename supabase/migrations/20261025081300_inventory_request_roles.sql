-- Admin hanya memutuskan permintaan; pengajuan oleh anggota dan advisor.
-- Policy insert lama mengizinkan admin mengajukan dan tidak mengizinkan advisor.

drop policy "component_requests: anggota mengajukan milik sendiri" on public.component_requests;
create policy "component_requests: anggota dan advisor mengajukan milik sendiri"
  on public.component_requests for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.current_user_role()) in ('anggota', 'advisor')
  );

drop policy "loan_requests: anggota mengajukan milik sendiri" on public.loan_requests;
create policy "loan_requests: anggota dan advisor mengajukan milik sendiri"
  on public.loan_requests for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.current_user_role()) in ('anggota', 'advisor')
  );
