export const STUDIO_SQL={
 project:'SELECT * FROM studio_projects WHERE id=? AND user_id=?',
 appendVersion:'INSERT INTO studio_versions (id,project_id,version,content,created_at) SELECT ?,id,?,?,? FROM studio_projects WHERE id=? AND user_id=? AND revision=?',
 updateProject:'UPDATE studio_projects SET title=?,mode=?,revision=?,updated_at=? WHERE id=? AND user_id=? AND revision=?'
};
