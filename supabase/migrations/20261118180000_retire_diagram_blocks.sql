-- The server no longer reads diagram blocks (#209), and refuses a course spec that
-- still has one, so every request that loads the course fails. This rewrites any
-- left in a stored spec or draft. The seeded diagram becomes the image the repo
-- ships for it; any other keeps its Mermaid source as a code block, so nothing a
-- lecturer wrote is lost and they can swap in an image later.
-- scripts/convert-diagrams.ts renders real images instead; after it has run, this
-- finds nothing to change.
create function pg_temp.retire_diagram_blocks(doc jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when jsonb_typeof(doc -> 'modules') is distinct from 'array' then doc
    else jsonb_set(doc, '{modules}', (
      select coalesce(jsonb_agg(
        case
          when jsonb_typeof(module #> '{content,materials}') = 'array' then
            jsonb_set(module, '{content,materials}', (
              select coalesce(jsonb_agg(
                case
                  when block ->> 'type' is distinct from 'diagram' then block
                  when block ->> 'mermaid' = E'flowchart LR\n  program[A program] --> shown["print()"]' then
                    '{"type":"image","url":"/course-images/first-program.png","alt":"Diagram: A program leads to print()."}'::jsonb
                  else jsonb_build_object('type', 'code', 'code', coalesce(nullif(btrim(block ->> 'mermaid'), ''), 'diagram'))
                end
                order by block_index), '[]'::jsonb)
              from jsonb_array_elements(module #> '{content,materials}') with ordinality as blocks(block, block_index)
            ))
          else module
        end
        order by module_index), '[]'::jsonb)
      from jsonb_array_elements(doc -> 'modules') with ordinality as modules(module, module_index)
    ))
  end
$$;

update public.courses
set spec = pg_temp.retire_diagram_blocks(spec),
    draft = pg_temp.retire_diagram_blocks(draft),
    updated_at = now()
where jsonb_path_exists(spec, '$.modules[*].content.materials[*] ? (@.type == "diagram")')
   or jsonb_path_exists(coalesce(draft, '{}'::jsonb), '$.modules[*].content.materials[*] ? (@.type == "diagram")');

drop function pg_temp.retire_diagram_blocks(jsonb);
