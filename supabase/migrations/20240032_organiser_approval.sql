-- Events must be secured with the organiser before vans can Accept.
-- Customer-submitted requests are approved by definition (the organiser came to us);
-- AI/staff-sourced events start unapproved until FoodTaxi secures them.
ALTER TABLE event_requests ADD COLUMN IF NOT EXISTS organiser_approved BOOLEAN DEFAULT true;
