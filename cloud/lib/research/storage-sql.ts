export const RESEARCH_SQL={
 acquire:"UPDATE research_control SET lease_id=?,lease_until=? WHERE id='main' AND revision=? AND lease_until<? RETURNING revision",
 source:"INSERT OR IGNORE INTO research_sources(id,url,title,hash,content,fetched_at,run_id) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM research_control WHERE id='main' AND revision=? AND lease_id=?)",
 run:"INSERT INTO research_runs(id,request_id,status,content,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM research_control WHERE id='main' AND revision=? AND lease_id=?)",
 commit:"UPDATE research_control SET content=?,revision=revision+1,lease_id=NULL,lease_until=0,updated_at=? WHERE id='main' AND revision=? AND lease_id=? RETURNING revision",
 release:"UPDATE research_control SET lease_id=NULL,lease_until=0 WHERE id='main' AND lease_id=?"
};
