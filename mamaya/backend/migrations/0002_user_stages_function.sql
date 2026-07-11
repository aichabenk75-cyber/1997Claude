-- Fonction utilisée par le feed algorithmique (FeedService.algoFeed) pour
-- matcher les posts dont l'audience_stage correspond au stade actuel du
-- lecteur. Logique miroir de PostsService.computeAudienceStage (TS).
CREATE OR REPLACE FUNCTION user_stages(p_user_id uuid)
RETURNS TABLE(stage text) AS $$
DECLARE
  v_status text;
  v_due_date date;
  v_youngest date;
  v_weeks_left numeric;
  v_weeks_in numeric;
  v_months numeric;
BEGIN
  SELECT u.status, u.due_date,
         (SELECT max(c.birth_month) FROM children c WHERE c.user_id = u.id)
    INTO v_status, v_due_date, v_youngest
  FROM users u WHERE u.id = p_user_id;

  IF v_status IS NULL THEN
    RETURN;
  END IF;

  IF v_status = 'enceinte' AND v_due_date IS NOT NULL THEN
    v_weeks_left := GREATEST(0, EXTRACT(EPOCH FROM (v_due_date - now())) / (7 * 86400));
    v_weeks_in := 40 - v_weeks_left;
    IF v_weeks_in < 14 THEN
      RETURN QUERY SELECT 'grossesse_t1';
    ELSIF v_weeks_in < 28 THEN
      RETURN QUERY SELECT 'grossesse_t2';
    ELSE
      RETURN QUERY SELECT 'grossesse_t3';
    END IF;
    RETURN;
  END IF;

  IF v_youngest IS NOT NULL THEN
    v_months := EXTRACT(EPOCH FROM (now() - v_youngest)) / (30.44 * 86400);
    IF v_months < 3 THEN
      RETURN QUERY SELECT 'bebe_0_3m';
    ELSIF v_months < 12 THEN
      RETURN QUERY SELECT 'bebe_3_12m';
    ELSIF v_months < 36 THEN
      RETURN QUERY SELECT 'enfant_1_3a';
    ELSE
      RETURN QUERY SELECT 'enfant_3a_plus';
    END IF;
  END IF;

  RETURN;
END;
$$ LANGUAGE plpgsql STABLE;
