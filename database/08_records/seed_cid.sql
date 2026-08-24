-- CSIB — reference data (real WHO ICD-10 codes, not fictional patient data).
-- A small, common-in-primary-care subset to search against; extend as needed.

insert into cid_codes (code, description, category) values
  ('A09', 'Diarreia e gastroenterite de origem infecciosa presumível', 'Doenças infecciosas'),
  ('B34.9', 'Infecção viral não especificada', 'Doenças infecciosas'),
  ('E11', 'Diabetes mellitus tipo 2', 'Doenças endócrinas'),
  ('E66', 'Obesidade', 'Doenças endócrinas'),
  ('F32', 'Episódio depressivo', 'Transtornos mentais'),
  ('F41.1', 'Transtorno de ansiedade generalizada', 'Transtornos mentais'),
  ('G43', 'Enxaqueca', 'Doenças do sistema nervoso'),
  ('I10', 'Hipertensão essencial (primária)', 'Doenças do aparelho circulatório'),
  ('J00', 'Nasofaringite aguda (resfriado comum)', 'Doenças respiratórias'),
  ('J02.9', 'Faringite aguda não especificada', 'Doenças respiratórias'),
  ('J03.9', 'Amigdalite aguda não especificada', 'Doenças respiratórias'),
  ('J11', 'Influenza (gripe)', 'Doenças respiratórias'),
  ('J45', 'Asma', 'Doenças respiratórias'),
  ('K29', 'Gastrite e duodenite', 'Doenças do aparelho digestivo'),
  ('K59.0', 'Constipação', 'Doenças do aparelho digestivo'),
  ('L23', 'Dermatite alérgica de contato', 'Doenças da pele'),
  ('M54.5', 'Dor lombar baixa', 'Doenças do sistema osteomuscular'),
  ('M79.1', 'Mialgia', 'Doenças do sistema osteomuscular'),
  ('N39.0', 'Infecção do trato urinário', 'Doenças do aparelho geniturinário'),
  ('R05', 'Tosse', 'Sintomas e sinais'),
  ('R50.9', 'Febre não especificada', 'Sintomas e sinais'),
  ('R51', 'Cefaleia', 'Sintomas e sinais'),
  ('R42', 'Tontura e instabilidade', 'Sintomas e sinais'),
  ('Z00.0', 'Exame médico geral', 'Fatores que influenciam o estado de saúde')
on conflict (code) do nothing;
