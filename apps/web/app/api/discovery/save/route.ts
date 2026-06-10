// @ts-nocheck
/*
SQL to create the discovered_businesses table:

create table if not exists discovered_businesses (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  phone text,
  website text,
  business_type text,
  source text default 'overpass',
  osm_id text unique,
  status text default 'discovered',
  invitation_sent_at timestamptz,
  notes text,
  created_at timestamptz default now()
);
*/

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, address, lat, lng, phone, website, business_type, source, osm_id } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    const { data, error } = await supabase
      .from('discovered_businesses')
      .upsert(
        {
          name,
          address:       address ?? '',
          lat:           lat ?? null,
          lng:           lng ?? null,
          phone:         phone ?? '',
          website:       website ?? '',
          business_type: business_type ?? '',
          source:        source ?? 'overpass',
          osm_id:        osm_id ?? null,
          status:        'discovered',
        },
        { onConflict: 'osm_id', ignoreDuplicates: false }
      )
      .select()
      .single()

    if (error) {
      console.error('discovery save error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'unknown error' }, { status: 500 })
  }
}
