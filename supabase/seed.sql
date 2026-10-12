-- Seed: the six curated route shells, with no stops.
-- Pandals are never seeded: they come from the admin portal or a verified CSV
-- import (docs/data-sourcing.md). Add stops to each route in /admin/routes
-- once real pandals exist.

insert into public.curated_routes (slug, region, title, title_bn, description, description_bn, start_label, travel_mode)
values
  ('north-kolkata-heritage-walk', 'north', 'North Kolkata walk', 'উত্তর কলকাতা পদযাত্রা',
   'A walking loop through the old neighbourhoods of North Kolkata.',
   'উত্তর কলকাতার পুরনো পাড়াগুলির মধ্য দিয়ে হাঁটাপথ।',
   'Shobhabazar Sutanuti Metro Station, Kolkata', 'walk'),
  ('central-kolkata-circuit', 'central', 'Central Kolkata circuit', 'মধ্য কলকাতা পরিক্রমা',
   'Pandals around the central business and college district.',
   'মধ্য কলকাতার অফিসপাড়া ও কলেজপাড়ার পুজো।',
   'Central Metro Station, Kolkata', 'walk'),
  ('south-kolkata-evening', 'south', 'South Kolkata evening', 'দক্ষিণ কলকাতার সন্ধ্যা',
   'An evening route through South Kolkata.',
   'দক্ষিণ কলকাতার সন্ধ্যার পুজো পরিক্রমা।',
   'Kalighat Metro Station, Kolkata', 'walk'),
  ('salt-lake-blocks', 'salt-lake', 'Salt Lake blocks', 'সল্টলেকের ব্লকে ব্লকে',
   'Block pujas across Salt Lake, best covered by car or two-wheeler.',
   'সল্টলেকের ব্লকের পুজো, গাড়ি বা বাইকে সুবিধাজনক।',
   'Karunamoyee Metro Station, Salt Lake, Kolkata', 'drive'),
  ('dum-dum-lake-town', 'dum-dum', 'Dum Dum and Lake Town', 'দমদম ও লেকটাউন',
   'Pandals around Dum Dum, Nagerbazar and Lake Town.',
   'দমদম, নাগেরবাজার ও লেকটাউনের পুজো।',
   'Dum Dum Metro Station, Kolkata', 'drive'),
  ('behala-trail', 'behala', 'Behala trail', 'বেহালা পরিক্রমা',
   'A route along the Behala stretch of Diamond Harbour Road.',
   'ডায়মন্ড হারবার রোড ধরে বেহালার পুজো।',
   'Behala Chowrasta Metro Station, Kolkata', 'drive')
on conflict (slug) do nothing;
