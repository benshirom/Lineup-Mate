-- Public RPC for join page preview: returns group+festival info without auth
CREATE OR REPLACE FUNCTION get_group_preview(p_code text)
RETURNS TABLE (festival_name text, group_name text, member_count bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    f.name AS festival_name,
    g.name AS group_name,
    COUNT(gm.id) AS member_count
  FROM groups g
  JOIN festivals f ON f.id = g.festival_id
  LEFT JOIN group_members gm ON gm.group_id = g.id
  WHERE g.invite_code = lower(p_code)
    AND g.is_blocked = false
  GROUP BY f.name, g.name;
$$;

GRANT EXECUTE ON FUNCTION get_group_preview TO anon;
GRANT EXECUTE ON FUNCTION get_group_preview TO authenticated;
