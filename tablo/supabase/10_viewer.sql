-- ============================================================
-- 10_viewer.sql — rôle « viewer » : voit les ventes et les stats, ne peut rien modifier
-- À exécuter UNE FOIS dans le SQL Editor de Supabase.
--
-- Rien d'autre à faire côté sécurité : avec les règles existantes (02_security.sql, 05_app.sql, 08_delete_tickets.sql)
--   - lecture : autorisée à tout profil connecté (my_role() is not null) → le viewer lit tout
--   - écriture : réservée à l'admin, au serveur sur SES tickets, ou au bar → le viewer ne peut rien écrire
-- Retour arrière : repasser les viewers en « serveur » depuis l'admin (une valeur d'enum ne se supprime pas).
-- ============================================================

alter type public.user_role add value if not exists 'viewer';

notify pgrst, 'reload schema';
