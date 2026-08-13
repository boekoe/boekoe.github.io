alter table public.posts add column if not exists image_urls text[] not null default '{}';

update public.posts
set image_urls = case
  when image_url ~ '^\s*\["https?://' then array(select jsonb_array_elements_text(image_url::jsonb))
  else array[image_url]
end
where image_url is not null and cardinality(image_urls) = 0;

comment on column public.posts.image_urls is 'Ordered public URLs for up to four images attached to a post.';
